package com.example.leave.api;

import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveStatus;
import com.example.leave.repository.LeaveRequestRepository;
import com.example.leave.service.LeaveService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/leaves")
@Validated
public class LeaveController {
    private final LeaveService service;
    private final LeaveRequestRepository requests;

    public LeaveController(LeaveService service, LeaveRequestRepository requests) {
        this.service = service;
        this.requests = requests;
    }

    @PostMapping
    public ResponseEntity<LeaveRequest> submit(@Valid @RequestBody SubmitLeaveRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.submit(body));
    }

    @GetMapping
    public List<LeaveRequest> mine(@RequestParam @NotBlank @Email String employeeEmail) {
        return requests.findByEmployeeEmailIgnoreCaseOrderByCreatedAtDesc(employeeEmail.trim());
    }

    @GetMapping("/pending")
    public List<LeaveRequest> pending() {
        return requests.findByStatusOrderByCreatedAtAsc(LeaveStatus.PENDING_APPROVAL);
    }

    @GetMapping("/{id}")
    public ResponseEntity<LeaveRequest> getById(@PathVariable Long id) {
        return requests.findById(id)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/decision")
    public ResponseEntity<Void> decide(@PathVariable Long id, @Valid @RequestBody DecisionRequest body) {
        service.decide(id, body);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/balance")
    public Map<String, Integer> balance(@RequestParam @NotBlank @Email String employeeEmail) {
        LeaveBalance balance = service.balance(employeeEmail);
        return Map.of("remainingDays", balance.getRemainingDays());
    }
}
