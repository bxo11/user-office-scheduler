import moment from 'moment';

import { ScheduledEventBookingType } from '../../src/generated/sdk';
import {
  defaultEventBookingHourDateTime,
  getHourDateTimeAfter,
  getFormattedDateAfter,
} from '../utils';

context('Scheduled events timeline tests', () => {
  before(() => {
    cy.resetDB();
    cy.resetSchedulerDB();
  });

  beforeEach(() => {
    cy.initializeSession('InstrumentScientist_1');
    cy.visit({
      url: '/calendar',
      timeout: 15000,
    });
  });

  describe('Scheduled events timeline', () => {
    const newScheduledEvent1 = {
      instrumentId: 1,
      bookingType: ScheduledEventBookingType.MAINTENANCE,
      startsAt: defaultEventBookingHourDateTime,
      endsAt: getHourDateTimeAfter(1),
      description: 'Test maintenance event',
    };
    const newScheduledEvent2 = {
      instrumentId: 1,
      bookingType: ScheduledEventBookingType.SHUTDOWN,
      startsAt: getHourDateTimeAfter(-2),
      endsAt: getHourDateTimeAfter(-1),
      description: 'Test shutdown event',
    };
    const newScheduledEvent3 = {
      instrumentId: 1,
      bookingType: ScheduledEventBookingType.MAINTENANCE,
      startsAt: getHourDateTimeAfter(8, 'days'),
      endsAt: getHourDateTimeAfter(9, 'days'),
      description: 'Test maintenance event',
    };
    it('should be able to switch between scheduled events timeline view and calendar view', () => {
      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.get('[data-cy="calendar-timeline-view"]').should('exist');

      cy.get('.rbc-time-view').should('not.exist');

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Calendar"]').click();

      cy.get('.rbc-time-view').should('exist');

      cy.get('[data-cy="calendar-timeline-view"]').should('not.exist');
    });

    it('should be able to see scheduled events in timeline view when instrument is selected', () => {
      cy.finishedLoading();
      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('#instrument-calls-tree-view [role=treeitem]').first().click();

      cy.get(
        '#instrument-calls-tree-view [role=treeitem] [role=group] [role=treeitem]'
      )
        .first()
        .click();

      cy.get('[data-cy="add-new-timeslot"]').click();

      cy.finishedLoading();

      cy.contains(defaultEventBookingHourDateTime);
      cy.contains(getHourDateTimeAfter(24));

      cy.get('[data-cy="btn-close-dialog"]').click();
      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.get('[data-cy="calendar-timeline-view"]').should('exist');

      cy.get('[data-cy="calendar-timeline-view"] .rct-items .rct-item').should(
        'have.length.above',
        0
      );

      cy.contains(defaultEventBookingHourDateTime)
        .parent()
        .should('have.attr', 'style')
        .and('include', 'background: rgb(')
        .and('include', 'filter: grayscale(0) opacity(0.6)');
    });

    it('should show timeline view of events in different colors depending on the event type', () => {
      cy.finishedLoading();
      cy.createEvent({ input: newScheduledEvent1 });
      cy.createEvent({ input: newScheduledEvent2 });

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.contains(newScheduledEvent1.endsAt)
        .parent()
        .should('have.attr', 'style')
        .and('include', 'background: rgb(');

      cy.contains(newScheduledEvent2.endsAt)
        .parent()
        .should('have.attr', 'style')
        .and('include', 'background: rgb(');
    });

    it('should be able to filter events based on the timeline toolbar filters', () => {
      cy.finishedLoading();
      cy.createEvent({ input: newScheduledEvent3 });

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.get('[data-cy="input-instrument-select"]').should('exist');

      cy.contains(newScheduledEvent1.endsAt);

      cy.contains(getFormattedDateAfter('dddd, D MMMM YYYY'));

      cy.get('[data-cy="calendar-timeline-view"]').should(
        'not.contain',
        newScheduledEvent3.startsAt
      );

      cy.get('.rbc-toolbar button')
        .contains('month', { matchCase: false })
        .click();

      cy.finishedLoading();

      cy.get('.rbc-toolbar button')
        .contains('today', { matchCase: false })
        .click();

      cy.finishedLoading();

      cy.contains(newScheduledEvent1.endsAt);

      if (
        moment(defaultEventBookingHourDateTime).month() !==
        moment(newScheduledEvent3.startsAt).month()
      ) {
        cy.get('[data-cy="calendar-timeline-view"]').should(
          'not.contain',
          newScheduledEvent3.startsAt
        );
      } else {
        cy.contains(newScheduledEvent3.startsAt);
      }

      cy.contains(getFormattedDateAfter('MMMM YYYY'));

      cy.get('.rbc-toolbar button')
        .contains('next', { matchCase: false })
        .click();

      cy.finishedLoading();

      cy.contains(getFormattedDateAfter('MMMM YYYY', 1, 'month'));

      if (
        moment(getFormattedDateAfter('MMMM YYYY', 1, 'month')).month() !==
        moment(newScheduledEvent3.startsAt).month()
      ) {
        cy.get('[data-cy="calendar-timeline-view"]').should(
          'not.contain',
          newScheduledEvent3.startsAt
        );
      } else {
        cy.contains(newScheduledEvent3.startsAt);
      }

      cy.get('[data-cy="calendar-timeline-view"]').should(
        'not.contain',
        newScheduledEvent1.endsAt
      );

      cy.get('.rbc-toolbar button')
        .contains('back', { matchCase: false })
        .click();
      cy.finishedLoading();
      cy.get('.rbc-toolbar button')
        .contains('back', { matchCase: false })
        .click();
      cy.finishedLoading();

      cy.contains(getFormattedDateAfter('MMMM YYYY', -1, 'month'));

      cy.get('[data-cy="calendar-timeline-view"]').should(
        'not.contain',
        newScheduledEvent3.startsAt
      );

      cy.get('[data-cy="calendar-timeline-view"]').should(
        'not.contain',
        newScheduledEvent1.startsAt
      );

      cy.get('.rbc-toolbar button')
        .contains('today', { matchCase: false })
        .click();
      cy.finishedLoading();

      cy.contains(getFormattedDateAfter('MMMM YYYY'));

      cy.contains(newScheduledEvent1.endsAt);
      if (
        moment(defaultEventBookingHourDateTime).month() !==
        moment(newScheduledEvent3.startsAt).month()
      ) {
        cy.get('[data-cy="calendar-timeline-view"]').should(
          'not.contain',
          newScheduledEvent3.startsAt
        );
      } else {
        cy.contains(newScheduledEvent3.startsAt);
      }

      cy.get('.rbc-toolbar button').contains('Day').click();
      cy.get('.rbc-toolbar button').contains('Today').click();

      cy.contains(getFormattedDateAfter('dddd, D MMMM YYYY'));
    });

    it('should be able to click and open events in timeline view', () => {
      cy.finishedLoading();

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      // cy.wait(500);

      cy.contains(newScheduledEvent1.endsAt).parent().click();

      cy.get('[role="none presentation"] [data-cy="startsAt"]').should('exist');
      cy.get('[role="none presentation"] [data-cy="endsAt"]').should('exist');
      cy.get('[role="none presentation"] [data-cy="bookingType"]').should(
        'exist'
      );

      cy.get('[data-cy="btn-close-dialog"]').click();

      // cy.wait(500);

      cy.contains(defaultEventBookingHourDateTime).first().parent().click();

      cy.get('[role="none presentation"] [data-cy="btn-save"]').should('exist');
      cy.get(
        '[role="none presentation"] [data-cy="activate-time-slot-booking"]'
      ).should('exist');
    });

    it('should not reset dates if page reloads', () => {
      cy.initializeSession('UserOfficer');
      cy.finishedLoading();

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.get('.rbc-toolbar button').contains('Day').click();
      cy.get('.rbc-toolbar button').contains('Today').click();

      cy.contains(getFormattedDateAfter('dddd, D MMMM YYYY'));

      cy.reload();

      cy.finishedLoading();

      cy.contains(getFormattedDateAfter('dddd, D MMMM YYYY'));

      cy.get('.rbc-toolbar button.rbc-active').contains('Day').click();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Calendar"]').click();

      cy.get('.rbc-toolbar button.rbc-active').contains('Day').click();
    });

    it('should be able to select multiple instruments in timeline view', () => {
      cy.initializeSession('UserOfficer');
      cy.visit({
        url: '/calendar',
        timeout: 15000,
      });

      cy.finishedLoading();

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      cy.get('[data-cy="input-instrument-select"] input').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .last()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="input-instrument-select"] input').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .eq(1)
        .click();

      cy.get(
        '[data-cy="calendar-timeline-view"] .react-calendar-timeline .rct-sidebar .rct-sidebar-row'
      ).should('have.length', '3');

      cy.reload();

      cy.finishedLoading();

      cy.get(
        '[data-cy="calendar-timeline-view"] .react-calendar-timeline .rct-sidebar .rct-sidebar-row'
      ).should('have.length', '3');

      cy.get(
        '[data-cy="calendar-timeline-view"] .react-calendar-timeline .rct-sidebar'
      ).should('include.text', 'Instrument 1');
      cy.get(
        '[data-cy="calendar-timeline-view"] .react-calendar-timeline .rct-sidebar'
      ).should('include.text', 'Instrument 2');
      cy.get(
        '[data-cy="calendar-timeline-view"] .react-calendar-timeline .rct-sidebar'
      ).should('include.text', 'Instrument 3');
    });

    it('should be able to scroll inside timeline view', () => {
      cy.initializeSession('UserOfficer');
      cy.visit({
        url: '/calendar',
        timeout: 15000,
      });

      cy.finishedLoading();

      cy.get('[data-cy=input-instrument-select]').click();

      cy.get('[aria-labelledby=input-instrument-select-label] [role=option]')
        .first()
        .click();

      cy.finishedLoading();

      cy.get('[data-cy="scheduler-active-view"]').click();
      cy.get('[data-value="Timeline"]').click();

      // NOTE: Getting the right element because that's how react-calendar-timeline works. They have added the scroll event listener on .rct scroll first and only child element.
      cy.get('.react-calendar-timeline .rct-scroll').children().first().click();

      cy.get('body').trigger('keypress', { code: 39 });

      // NOTE: cy.tick is used to be able to execute the handleTimeChange because it's debounced with 500ms.
      cy.tick(500);

      cy.url().should('include', 'startsAt=');
    });
  });
});
