package com.example.leave.service;

import com.example.leave.api.DecisionRequest;
import com.example.leave.api.SubmitLeaveRequest;
import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveStatus;
import com.example.leave.domain.LeaveType;
import com.example.leave.repository.LeaveBalanceRepository;
import com.example.leave.repository.LeaveRequestRepository;
import io.camunda.client.CamundaClient;
import io.camunda.client.api.search.enums.UserTaskState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class LeaveService {
    private static final Logger log = LoggerFactory.getLogger(LeaveService.class);
    private static final int DEFAULT_ANNUAL_ENTITLEMENT = 20;
    private static final int USER_TASK_SEARCH_ATTEMPTS = 6;
    private static final long USER_TASK_SEARCH_DELAY_MS = 500L;

    private final LeaveRequestRepository requests;
    private final LeaveBalanceRepository balances;
    private final CamundaClient camundaClient;
    private final NotificationService notifications;

    public LeaveService(
        LeaveRequestRepository requests,
        LeaveBalanceRepository balances,
        CamundaClient camundaClient,
        NotificationService notifications
    ) {
        this.requests = requests;
        this.balances = balances;
        this.camundaClient = camundaClient;
        this.notifications = notifications;
    }

    /** Persist first, then start the workflow so the worker can always read the request. */
    public LeaveRequest submit(SubmitLeaveRequest body) {
        if (body.endDate().isBefore(body.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "End date must be the same as or later than the start date.");
        }

        LeaveType leaveType = LeaveType.valueOf(body.leaveType());
        String email = normaliseEmail(body.employeeEmail());
        int days = WorkingDaysCalculator.count(body.startDate(), body.endDate());

        LeaveRequest request = new LeaveRequest();
        request.setEmployeeName(body.employeeName().trim());
        request.setEmployeeEmail(email);
        request.setLeaveType(leaveType);
        request.setStartDate(body.startDate());
        request.setEndDate(body.endDate());
        request.setDays(days);
        request.setReason(body.reason() == null ? "" : body.reason().trim());
        request.setStatus(LeaveStatus.SUBMITTED);
        request.setStatusMessage("Request submitted. Validation is in progress.");
        request = requests.saveAndFlush(request);

        if (leaveType == LeaveType.ANNUAL) {
            getOrCreateBalance(email);
        }

        Map<String, Object> variables = new HashMap<>();
        variables.put("requestId", request.getId());
        variables.put("employeeEmail", email);
        variables.put("leaveType", leaveType.name());
        variables.put("days", days);
        variables.put("startDate", body.startDate().toString());
        variables.put("endDate", body.endDate().toString());

        try {
            var process = camundaClient.newCreateInstanceCommand()
                .bpmnProcessId("leave-request")
                .latestVersion()
                .variables(variables)
                .send()
                .join();
            requests.updateProcessInstanceKey(request.getId(), process.getProcessInstanceKey());
            return requests.findById(request.getId()).orElseThrow();
        } catch (RuntimeException exception) {
            log.error("Unable to start Camunda process for leave request {}", request.getId(), exception);
            requests.findById(request.getId()).ifPresent(saved -> {
                saved.setStatus(LeaveStatus.REJECTED);
                saved.setStatusMessage("Workflow could not be started. Check the Camunda connection and try again.");
                requests.save(saved);
            });
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "The workflow engine could not start this request. Verify that Camunda 8 is running.", exception);
        }
    }

    public void decide(Long id, DecisionRequest decision) {
        LeaveRequest request = requests.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave request not found."));

        if (request.getStatus() != LeaveStatus.PENDING_APPROVAL) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This request is not currently waiting for manager approval.");
        }
        if (request.getProcessInstanceKey() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "The workflow process key is not available yet. Refresh and retry.");
        }

        RuntimeException lastFailure = null;
        for (int attempt = 0; attempt < USER_TASK_SEARCH_ATTEMPTS; attempt++) {
            try {
                var tasks = camundaClient.newUserTaskSearchRequest()
                    .filter(filter -> filter.processInstanceKey(request.getProcessInstanceKey())
                        .state(UserTaskState.CREATED))
                    .send()
                    .join()
                    .items();
                // A successful empty search should ultimately produce a 409, not preserve an old transport error.
                lastFailure = null;

                if (!tasks.isEmpty()) {
                    var task = tasks.getFirst();
                    Map<String, Object> variables = new HashMap<>();
                    variables.put("approved", decision.approved());
                    variables.put("managerComment", decision.comment() == null ? "" : decision.comment().trim());
                    camundaClient.newCompleteUserTaskCommand(task.getUserTaskKey())
                        .variables(variables)
                        .send()
                        .join();
                    return;
                }
            } catch (RuntimeException exception) {
                lastFailure = exception;
                log.warn("Camunda user-task lookup attempt {} failed for leave request {}: {}",
                    attempt + 1, id, exception.getMessage());
            }
            if (attempt + 1 < USER_TASK_SEARCH_ATTEMPTS) {
                try {
                    Thread.sleep(USER_TASK_SEARCH_DELAY_MS);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Interrupted while waiting for the manager task to become available.", interrupted);
                }
            }
        }

        if (lastFailure != null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Could not communicate with Camunda while completing the manager task.", lastFailure);
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT,
            "The manager task is not indexed yet. Wait a moment and retry.");
    }

    @Transactional
    public Map<String, Object> validate(Long requestId) {
        LeaveRequest request = requests.findByIdForUpdate(requestId)
            .orElseThrow(() -> new IllegalStateException("Leave request " + requestId + " does not exist."));

        String validationMessage = "OK";
        boolean valid = true;

        if (request.getEndDate().isBefore(request.getStartDate())) {
            valid = false;
            validationMessage = "End date must be the same as or later than the start date.";
        } else if (request.getDays() <= 0) {
            valid = false;
            validationMessage = "The selected date range contains no working days.";
        } else if (request.getLeaveType() == LeaveType.ANNUAL) {
            LeaveBalance balance = getOrCreateBalance(request.getEmployeeEmail());
            if (balance.getRemainingDays() < request.getDays()) {
                valid = false;
                validationMessage = "Insufficient annual leave balance. " + balance.getRemainingDays()
                    + " day(s) remain, but " + request.getDays() + " day(s) were requested.";
            }
        }

        if (valid) {
            request.setStatus(LeaveStatus.PENDING_APPROVAL);
            request.setStatusMessage("Validated — awaiting manager approval.");
        } else {
            // Keep it non-terminal until the BPMN finalize-leave worker records rejection.
            request.setStatus(LeaveStatus.SUBMITTED);
            request.setStatusMessage(validationMessage);
        }
        requests.save(request);

        return Map.of("valid", valid, "validationMessage", validationMessage);
    }

    @Transactional
    public void finalizeRequest(Long requestId, boolean approved, String managerComment, String validationMessage) {
        LeaveRequest request = requests.findByIdForUpdate(requestId)
            .orElseThrow(() -> new IllegalStateException("Leave request " + requestId + " does not exist."));

        // A retried Camunda job must not deduct the same annual leave twice.
        if (request.getStatus() == LeaveStatus.APPROVED || request.getStatus() == LeaveStatus.REJECTED) {
            return;
        }

        String comment = managerComment == null ? "" : managerComment.trim();
        if (approved) {
            if (request.getLeaveType() == LeaveType.ANNUAL && !request.isBalanceDeducted()) {
                LeaveBalance balance = balances.findByEmailForUpdate(request.getEmployeeEmail())
                    .orElseGet(() -> new LeaveBalance(request.getEmployeeEmail(), DEFAULT_ANNUAL_ENTITLEMENT));
                if (balance.getRemainingDays() < request.getDays()) {
                    request.setStatus(LeaveStatus.REJECTED);
                    request.setStatusMessage("Insufficient annual leave balance at final approval. No days were deducted.");
                    requests.save(request);
                    notifications.leaveFinalised(request);
                    return;
                }
                balance.setRemainingDays(balance.getRemainingDays() - request.getDays());
                balances.save(balance);
                request.setBalanceDeducted(true);
            }
            request.setStatus(LeaveStatus.APPROVED);
            request.setStatusMessage(comment.isBlank() ? "Approved by manager." : "Approved: " + comment);
        } else {
            request.setStatus(LeaveStatus.REJECTED);
            String fallback = (validationMessage == null || validationMessage.isBlank()
                || "OK".equalsIgnoreCase(validationMessage.trim()))
                ? "Rejected by manager." : validationMessage;
            request.setStatusMessage(comment.isBlank() ? fallback : "Rejected: " + comment);
        }

        requests.save(request);
        notifications.leaveFinalised(request);
    }

    @Transactional
    public LeaveBalance balance(String employeeEmail) {
        return getOrCreateBalance(normaliseEmail(employeeEmail));
    }

    private LeaveBalance getOrCreateBalance(String email) {
        Optional<LeaveBalance> found = balances.findById(email);
        if (found.isPresent()) {
            return found.get();
        }
        try {
            return balances.saveAndFlush(new LeaveBalance(email, DEFAULT_ANNUAL_ENTITLEMENT));
        } catch (RuntimeException duplicateInsert) {
            // Another request may have initialised the balance concurrently.
            return balances.findById(email).orElseThrow(() -> duplicateInsert);
        }
    }

    private static String normaliseEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
