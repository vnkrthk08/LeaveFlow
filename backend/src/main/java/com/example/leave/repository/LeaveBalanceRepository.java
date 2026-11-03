package com.example.leave.repository;

import com.example.leave.domain.LeaveBalance;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from LeaveBalance b where b.employeeEmail = :email")
    Optional<LeaveBalance> findByEmailForUpdate(@Param("email") String email);
}
