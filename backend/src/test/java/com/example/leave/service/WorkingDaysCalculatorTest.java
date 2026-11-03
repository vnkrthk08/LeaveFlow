package com.example.leave.service;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WorkingDaysCalculatorTest {
    @Test
    void countsWeekdaysInclusively() {
        assertEquals(5, WorkingDaysCalculator.count(
            LocalDate.of(2026, 11, 2), LocalDate.of(2026, 11, 6)));
    }

    @Test
    void excludesSaturdayAndSunday() {
        assertEquals(0, WorkingDaysCalculator.count(
            LocalDate.of(2026, 11, 7), LocalDate.of(2026, 11, 8)));
    }

    @Test
    void countsWeekdayAcrossWeekend() {
        assertEquals(3, WorkingDaysCalculator.count(
            LocalDate.of(2026, 11, 6), LocalDate.of(2026, 11, 10)));
    }

    @Test
    void countsSingleWeekdayAsOne() {
        assertEquals(1, WorkingDaysCalculator.count(
            LocalDate.of(2026, 11, 3), LocalDate.of(2026, 11, 3)));
    }

    @Test
    void returnsZeroForReversedOrNullDates() {
        assertEquals(0, WorkingDaysCalculator.count(
            LocalDate.of(2026, 11, 10), LocalDate.of(2026, 11, 6)));
        assertEquals(0, WorkingDaysCalculator.count(null, LocalDate.of(2026, 11, 6)));
    }
}
