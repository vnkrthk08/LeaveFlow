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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeaveServiceTest {

    @Mock
    private LeaveRequestRepository requests;

    @Mock
    private LeaveBalanceRepository balances;

    @Mock
    private CamundaClient camundaClient;

    @Mock
    private NotificationService notifications;

    private LeaveService service;

    @BeforeEach
    void setUp() {
        service = new LeaveService(requests, balances, camundaClient, notifications);
    }

    @Test
    @DisplayName("Submit throws BadRequest when end date is before start date")
    void submitRejectsReversedDates() {
        SubmitLeaveRequest request = new SubmitLeaveRequest(
            "Alice", "alice@example.com", "ANNUAL",
            LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 5), "Vacation"
        );

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.submit(request));
        assertTrue(ex.getReason().contains("End date must be the same as or later than the start date"));
    }

    @Test
    @DisplayName("Validate approves valid annual leave request with sufficient balance")
    void validateApprovesValidAnnualLeave() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("alice@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setStartDate(LocalDate.of(2026, 11, 9));
        request.setEndDate(LocalDate.of(2026, 11, 11));
        request.setDays(3);

        when(requests.findByIdForUpdate(1L)).thenReturn(Optional.of(request));
        when(balances.findById("alice@example.com")).thenReturn(Optional.of(new LeaveBalance("alice@example.com", 20)));

        Map<String, Object> result = service.validate(1L);

        assertTrue((Boolean) result.get("valid"));
        assertEquals("OK", result.get("validationMessage"));
        assertEquals(LeaveStatus.PENDING_APPROVAL, request.getStatus());
        verify(requests).save(request);
    }

    @Test
    @DisplayName("Validate rejects request with zero working days (weekend-only)")
    void validateRejectsZeroWorkingDays() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("alice@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setStartDate(LocalDate.of(2026, 11, 7));
        request.setEndDate(LocalDate.of(2026, 11, 8));
        request.setDays(0);

        when(requests.findByIdForUpdate(2L)).thenReturn(Optional.of(request));

        Map<String, Object> result = service.validate(2L);

        assertFalse((Boolean) result.get("valid"));
        assertEquals("The selected date range contains no working days.", result.get("validationMessage"));
        assertEquals(LeaveStatus.SUBMITTED, request.getStatus());
        verify(requests).save(request);
    }

    @Test
    @DisplayName("Validate rejects request when annual leave balance is insufficient")
    void validateRejectsInsufficientBalance() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("bob@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setStartDate(LocalDate.of(2026, 11, 9));
        request.setEndDate(LocalDate.of(2026, 11, 20));
        request.setDays(10);

        when(requests.findByIdForUpdate(3L)).thenReturn(Optional.of(request));
        when(balances.findById("bob@example.com")).thenReturn(Optional.of(new LeaveBalance("bob@example.com", 5)));

        Map<String, Object> result = service.validate(3L);

        assertFalse((Boolean) result.get("valid"));
        assertTrue(((String) result.get("validationMessage")).contains("Insufficient annual leave balance"));
        assertEquals(LeaveStatus.SUBMITTED, request.getStatus());
    }

    @Test
    @DisplayName("Finalize deducts annual leave balance upon approval")
    void finalizeDeductsBalanceOnApproval() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("alice@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setDays(3);
        request.setStatus(LeaveStatus.PENDING_APPROVAL);

        LeaveBalance balance = new LeaveBalance("alice@example.com", 20);
        when(requests.findByIdForUpdate(1L)).thenReturn(Optional.of(request));
        when(balances.findByEmailForUpdate("alice@example.com")).thenReturn(Optional.of(balance));

        service.finalizeRequest(1L, true, "Approved enjoy!", "OK");

        assertEquals(LeaveStatus.APPROVED, request.getStatus());
        assertTrue(request.isBalanceDeducted());
        assertEquals(17, balance.getRemainingDays());
        verify(balances).save(balance);
        verify(requests).save(request);
        verify(notifications).leaveFinalised(request);
    }

    @Test
    @DisplayName("Finalize does not deduct balance upon manager rejection")
    void finalizeDoesNotDeductBalanceOnRejection() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("alice@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setDays(3);
        request.setStatus(LeaveStatus.PENDING_APPROVAL);

        when(requests.findByIdForUpdate(1L)).thenReturn(Optional.of(request));

        service.finalizeRequest(1L, false, "Not enough coverage", "OK");

        assertEquals(LeaveStatus.REJECTED, request.getStatus());
        assertFalse(request.isBalanceDeducted());
        verify(balances, never()).save(any());
        verify(requests).save(request);
        verify(notifications).leaveFinalised(request);
    }

    @Test
    @DisplayName("Finalize is idempotent and does not deduct balance twice if Camunda retries")
    void finalizeIsIdempotentOnRetry() {
        LeaveRequest request = new LeaveRequest();
        request.setEmployeeEmail("alice@example.com");
        request.setLeaveType(LeaveType.ANNUAL);
        request.setDays(3);
        request.setStatus(LeaveStatus.APPROVED);
        request.setBalanceDeducted(true);

        when(requests.findByIdForUpdate(1L)).thenReturn(Optional.of(request));

        service.finalizeRequest(1L, true, "Approved", "OK");

        verify(balances, never()).save(any());
        verify(requests, never()).save(request);
    }
}
