package com.example.leave.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "leave_balances")
public class LeaveBalance {
    @Id
    @Column(length = 180)
    private String employeeEmail;

    @Column(nullable = false)
    private int remainingDays;

    @Version
    private Long version;

    protected LeaveBalance() { }

    public LeaveBalance(String employeeEmail, int remainingDays) {
        this.employeeEmail = employeeEmail;
        this.remainingDays = remainingDays;
    }

    public String getEmployeeEmail() { return employeeEmail; }
    public int getRemainingDays() { return remainingDays; }
    public void setRemainingDays(int remainingDays) { this.remainingDays = remainingDays; }
}
