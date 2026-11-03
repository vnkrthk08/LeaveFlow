package com.example.leave.service;

import com.example.leave.domain.LeaveRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/** Notification extension point. This MVP logs events; it does not send email. */
@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    public void leaveFinalised(LeaveRequest request) {
        log.info("Leave request {} finalised with status {} for {}",
            request.getId(), request.getStatus(), request.getEmployeeEmail());
    }
}
