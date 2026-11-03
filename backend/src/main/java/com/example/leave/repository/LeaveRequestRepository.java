package com.example.leave.repository;

import com.example.leave.domain.LeaveRequest;
import com.example.leave.domain.LeaveStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {
    List<LeaveRequest> findByEmployeeEmailIgnoreCaseOrderByCreatedAtDesc(String employeeEmail);
    List<LeaveRequest> findByStatusOrderByCreatedAtAsc(LeaveStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from LeaveRequest r where r.id = :id")
    Optional<LeaveRequest> findByIdForUpdate(@Param("id") Long id);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update LeaveRequest r set r.processInstanceKey = :key where r.id = :id")
    int updateProcessInstanceKey(@Param("id") Long id, @Param("key") Long processInstanceKey);
}
