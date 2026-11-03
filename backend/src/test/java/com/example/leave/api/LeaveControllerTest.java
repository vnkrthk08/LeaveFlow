package com.example.leave.api;

import com.example.leave.domain.LeaveBalance;
import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveStatus;
import com.example.leave.domain.LeaveType;
import com.example.leave.repository.LeaveRequestRepository;
import com.example.leave.service.LeaveService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class LeaveControllerTest {

    private MockMvc mockMvc;

    @Mock
    private LeaveService service;

    @Mock
    private LeaveRequestRepository requests;

    @InjectMocks
    private LeaveController controller;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new ApiExceptionHandler())
            .build();
    }

    @Test
    @DisplayName("POST /api/leaves creates a leave request when valid")
    void submitValidRequest() throws Exception {
        LeaveRequest saved = new LeaveRequest();
        saved.setEmployeeName("Alice");
        saved.setEmployeeEmail("alice@example.com");
        saved.setLeaveType(LeaveType.ANNUAL);
        saved.setStartDate(LocalDate.of(2026, 11, 9));
        saved.setEndDate(LocalDate.of(2026, 11, 11));
        saved.setDays(3);
        saved.setStatus(LeaveStatus.SUBMITTED);

        when(service.submit(any(SubmitLeaveRequest.class))).thenReturn(saved);

        String json = """
            {
              "employeeName": "Alice",
              "employeeEmail": "alice@example.com",
              "leaveType": "ANNUAL",
              "startDate": "2026-11-09",
              "endDate": "2026-11-11",
              "reason": "Personal time"
            }
            """;

        mockMvc.perform(post("/api/leaves")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.employeeName").value("Alice"))
            .andExpect(jsonPath("$.employeeEmail").value("alice@example.com"))
            .andExpect(jsonPath("$.days").value(3))
            .andExpect(jsonPath("$.status").value("SUBMITTED"));
    }

    @Test
    @DisplayName("POST /api/leaves rejects invalid payload")
    void submitInvalidRequestReturnsBadRequest() throws Exception {
        String invalidJson = """
            {
              "employeeName": "",
              "employeeEmail": "not-an-email",
              "leaveType": "INVALID_TYPE",
              "startDate": null,
              "endDate": null
            }
            """;

        mockMvc.perform(post("/api/leaves")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidJson))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    @Test
    @DisplayName("GET /api/leaves?employeeEmail=... returns employee requests")
    void getMyRequests() throws Exception {
        LeaveRequest r = new LeaveRequest();
        r.setEmployeeName("Alice");
        r.setEmployeeEmail("alice@example.com");
        r.setLeaveType(LeaveType.ANNUAL);
        r.setStartDate(LocalDate.of(2026, 11, 9));
        r.setEndDate(LocalDate.of(2026, 11, 11));
        r.setDays(3);

        when(requests.findByEmployeeEmailIgnoreCaseOrderByCreatedAtDesc("alice@example.com"))
            .thenReturn(List.of(r));

        mockMvc.perform(get("/api/leaves")
                .param("employeeEmail", "alice@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].employeeEmail").value("alice@example.com"))
            .andExpect(jsonPath("$[0].days").value(3));
    }

    @Test
    @DisplayName("GET /api/leaves/pending returns pending requests")
    void getPendingRequests() throws Exception {
        LeaveRequest r = new LeaveRequest();
        r.setEmployeeEmail("bob@example.com");
        r.setStatus(LeaveStatus.PENDING_APPROVAL);

        when(requests.findByStatusOrderByCreatedAtAsc(LeaveStatus.PENDING_APPROVAL))
            .thenReturn(List.of(r));

        mockMvc.perform(get("/api/leaves/pending"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].employeeEmail").value("bob@example.com"))
            .andExpect(jsonPath("$[0].status").value("PENDING_APPROVAL"));
    }

    @Test
    @DisplayName("POST /api/leaves/{id}/decision submits decision")
    void submitDecision() throws Exception {
        String json = """
            {
              "approved": true,
              "comment": "Have fun!"
            }
            """;

        mockMvc.perform(post("/api/leaves/10/decision")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .andExpect(status().isNoContent());

        verify(service).decide(eq(10L), any(DecisionRequest.class));
    }

    @Test
    @DisplayName("GET /api/leaves/balance returns remaining days")
    void getBalance() throws Exception {
        when(service.balance("alice@example.com"))
            .thenReturn(new LeaveBalance("alice@example.com", 17));

        mockMvc.perform(get("/api/leaves/balance")
                .param("employeeEmail", "alice@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.remainingDays").value(17));
    }
}
