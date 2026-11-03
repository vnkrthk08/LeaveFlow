package com.example.leave.service;

import java.time.DayOfWeek;
import java.time.LocalDate;

/** Counts weekdays inclusively. Public holidays are intentionally not modelled in this MVP. */
public final class WorkingDaysCalculator {
    private WorkingDaysCalculator() { }

    public static int count(LocalDate startDate, LocalDate endDate) {
        if (startDate == null || endDate == null || endDate.isBefore(startDate)) {
            return 0;
        }
        int days = 0;
        for (LocalDate day = startDate; !day.isAfter(endDate); day = day.plusDays(1)) {
            DayOfWeek weekday = day.getDayOfWeek();
            if (weekday != DayOfWeek.SATURDAY && weekday != DayOfWeek.SUNDAY) {
                days++;
            }
        }
        return days;
    }
}
