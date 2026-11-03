package com.example.leave.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record SubmitLeaveRequest(
    @NotBlank @Size(max = 120) String employeeName,
    @NotBlank @Email @Size(max = 180) String employeeEmail,
    @NotBlank @Pattern(regexp = "ANNUAL|SICK|UNPAID", message = "Leave type must be ANNUAL, SICK or UNPAID") String leaveType,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @Size(max = 1000) String reason
) { }
