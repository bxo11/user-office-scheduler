import { Grid, makeStyles } from '@material-ui/core';
import clsx from 'clsx';
import generateScheduledEventFilter from 'filters/scheduledEvent/scheduledEventsFilter';
import moment from 'moment';
import 'moment/locale/en-gb';
import React, { useState, useMemo, useContext, useEffect } from 'react';
import {
  Calendar as BigCalendar,
  momentLocalizer,
  View,
} from 'react-big-calendar';

import Loader from 'components/common/Loader';
import ProposalBookingDialog from 'components/proposalBooking/ProposalBookingDialog';
import ScheduledEventDialog, {
  SlotInfo,
} from 'components/scheduledEvent/ScheduledEventDialog';
import { BookingTypesMap } from 'components/scheduledEvent/ScheduledEventForm';
import { AppContext } from 'context/AppContext';
import {
  ScheduledEvent,
  ScheduledEventBookingType,
  GetScheduledEventsQuery,
  Call,
  Proposal,
  ProposalBooking,
} from 'generated/sdk';
import { useQuery } from 'hooks/common/useQuery';
import useInstrumentProposalBookings, {
  InstrumentProposalBooking,
} from 'hooks/proposalBooking/useInstrumentProposalBookings';
import useEquipmentScheduledEvents from 'hooks/scheduledEvent/useEquipmentScheduledEvents';
import useScheduledEvents from 'hooks/scheduledEvent/useScheduledEvents';
import { ContentContainer, StyledPaper } from 'styles/StyledComponents';
import { parseTzLessDateTime } from 'utils/date';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'styles/react-big-calendar.css';

import CalendarTodoBox from './CalendarTodoBox';
import Event, { CalendarScheduledEvent, eventPropGetter } from './Event';
import Toolbar from './Toolbar';
import YearView from './YearView';

moment.locale('en-gb');

const localizer = momentLocalizer(moment);

const CALENDAR_DEFAULT_VIEW = 'week';

export type ExtendedView = View | 'year';

const useStyles = makeStyles(() => ({
  fullHeight: {
    height: '100%',
  },
  relative: {
    position: 'relative',
  },
  eventDescription: {
    marginTop: 5,
  },
}));

const transformEvent = (
  scheduledEvents: GetScheduledEventsQuery['scheduledEvents']
): CalendarScheduledEvent[] =>
  scheduledEvents.map((scheduledEvent) => ({
    id: scheduledEvent.id,
    start: parseTzLessDateTime(scheduledEvent.startsAt).toDate(),
    end: parseTzLessDateTime(scheduledEvent.endsAt).toDate(),
    title: BookingTypesMap[scheduledEvent.bookingType],
    bookingType: scheduledEvent.bookingType,
    description: scheduledEvent.description,
    proposalBooking: scheduledEvent.proposalBooking,
    instrument: scheduledEvent.instrument,
    scheduledBy: scheduledEvent.scheduledBy,
  }));

function isOverlapping(
  { start, end }: { start: Date | string; end: Date | string },
  calendarEvents: CalendarScheduledEvent[]
): boolean {
  return calendarEvents.some((calendarEvent) => {
    if (
      (calendarEvent.start >= start && calendarEvent.end <= end) ||
      //
      (calendarEvent.start < end && calendarEvent.end > start)
    ) {
      return true;
    }

    return false;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slotPropGetter(date: Date): any {
  return {
    'data-cy': `event-slot-${date.toISOString()}`,
  };
}

export default function Calendar() {
  const classes = useStyles();

  const query = useQuery();
  const queryInstrument = query.get('instrument');
  const queryEquipment =
    query
      .get('equipment')
      ?.split(',')
      .map((num) => parseInt(num)) || [];

  const { showAlert } = useContext(AppContext);
  const [selectedEvent, setSelectedEvent] = useState<
    | Pick<
        ScheduledEvent,
        'id' | 'bookingType' | 'startsAt' | 'endsAt' | 'description'
      >
    | SlotInfo
    | null
  >(null);
  const [startsAt, setStartAt] = useState(
    moment().startOf(CALENDAR_DEFAULT_VIEW).toDate()
  );
  const [view, setView] = useState<ExtendedView>(CALENDAR_DEFAULT_VIEW);
  const [filter, setFilter] = useState(
    generateScheduledEventFilter(queryInstrument, startsAt, view)
  );
  const [selectedProposalBooking, setSelectedProposalBooking] =
    useState<InstrumentProposalBooking | null>(null);

  const {
    proposalBookings,
    loading: loadingBookings,
    refresh: refreshBookings,
  } = useInstrumentProposalBookings(queryInstrument);

  const {
    scheduledEvents,
    loading: loadingEvents,
    refresh: refreshEvents,
  } = useScheduledEvents(filter);

  const {
    scheduledEvents: eqEvents,
    selectedEquipment,
    setSelectedEquipments,
  } = useEquipmentScheduledEvents(
    queryEquipment,
    filter.startsAt,
    filter.endsAt
  );

  const refresh = () => {
    refreshEvents();
    refreshBookings();
  };
  if (
    selectedEquipment.length !== queryEquipment.length ||
    !selectedEquipment.every((eq) => queryEquipment.includes(eq))
  ) {
    setSelectedEquipments(queryEquipment);
  }
  useEffect(() => {
    setFilter(generateScheduledEventFilter(queryInstrument, startsAt, view));
  }, [queryInstrument, startsAt, view]);

  const eqEventsTransformed: GetScheduledEventsQuery['scheduledEvents'] =
    eqEvents
      .map((eq) =>
        eq.events.map((event) => ({
          ...event,
          bookingType: ScheduledEventBookingType.EQUIPMENT,
          description: eq.name,
          proposalBooking: event.proposalBooking as ProposalBooking,
          instrument: event.instrument,
          scheduledBy: event.scheduledBy,
        }))
      )
      .flat(1);

  const events = useMemo(
    () => transformEvent([...scheduledEvents, ...eqEventsTransformed]),
    [scheduledEvents, eqEventsTransformed]
  );

  const onNavigate = (newDate: Date, newView: View) => {
    setStartAt(newDate);
    setView(newView);
  };

  const onViewChange = (newView: View) => {
    setView(newView);
  };

  const onSelectSlot = (slotInfo: SlotInfo) => {
    if (isOverlapping({ start: slotInfo.start, end: slotInfo.end }, events)) {
      return;
    }

    if (!queryInstrument) {
      showAlert({ message: <>You have to select an instrument</> });

      return;
    }

    setSelectedEvent(slotInfo);
  };

  const onSelecting = (range: { start: Date | string; end: Date | string }) => {
    return !isOverlapping(range, events);
  };

  const closeDialog = (shouldRefresh?: boolean) => {
    setSelectedEvent(null);

    if (shouldRefresh) {
      refresh();
    }
  };

  const onSelectEvent = ({ id }: CalendarScheduledEvent) => {
    const scheduledEvent = scheduledEvents.find((se) => se.id === id);

    if (scheduledEvent) {
      if (
        scheduledEvent.proposalBooking &&
        scheduledEvent.bookingType === ScheduledEventBookingType.USER_OPERATIONS
      ) {
        // NOTE: Types here are a bit of a mess. It needs more attention to fix.
        setSelectedProposalBooking({
          allocatedTime: scheduledEvent.proposalBooking.allocatedTime,
          call: scheduledEvent.proposalBooking.call as Call,
          createdAt: scheduledEvent.proposalBooking.createdAt,
          id: scheduledEvent.proposalBooking.id,
          proposal: scheduledEvent.proposalBooking.proposal as Proposal,
          scheduledEvents: scheduledEvent.proposalBooking
            .scheduledEvents as ScheduledEvent[],
          status: scheduledEvent.proposalBooking.status,
          updatedAt: scheduledEvent.proposalBooking.updatedAt,
        });
      } else {
        setSelectedEvent(scheduledEvent);
      }
    }
  };

  const handleNewSimpleEvent = () => {
    const start = moment().startOf('hour').toDate();

    const end = moment().startOf('hour').add(1, 'hour').toDate();

    setSelectedEvent({
      action: 'click',
      start,
      end,
      slots: [start, end],
    });
  };

  const handleCloseDialog = (shouldRefresh?: boolean) => {
    setSelectedProposalBooking(null);

    if (shouldRefresh) {
      refresh();
    }
  };

  // 100% height needed for month view
  // also the other components make whole page scrollable without it
  return (
    <ContentContainer maxWidth={false} className={classes.fullHeight}>
      <Grid container className={classes.fullHeight}>
        <Grid item xs={12} className={classes.fullHeight}>
          <StyledPaper
            margin={[0, 1]}
            className={clsx(classes.fullHeight, classes.relative)}
          >
            {queryInstrument && (
              <ScheduledEventDialog
                selectedEvent={selectedEvent}
                selectedInstrumentId={queryInstrument}
                isDialogOpen={selectedEvent !== null}
                closeDialog={closeDialog}
              />
            )}
            {selectedProposalBooking !== null && (
              <ProposalBookingDialog
                activeProposalBookingId={selectedProposalBooking.id}
                isDialogOpen={true}
                closeDialog={handleCloseDialog}
              />
            )}
            <Grid container className={classes.fullHeight}>
              <Grid item xs={10} className={classes.fullHeight}>
                {
                  // @ts-expect-error test
                  <BigCalendar
                    selectable
                    // TODO: needs some position fixing
                    // popup
                    localizer={localizer}
                    events={events}
                    defaultView={CALENDAR_DEFAULT_VIEW}
                    views={{
                      day: true,
                      week: true,
                      month: true,
                      year: YearView,
                    }}
                    defaultDate={startsAt}
                    step={60}
                    timeslots={1}
                    showMultiDayTimes={true}
                    dayLayoutAlgorithm={'no-overlap'}
                    eventPropGetter={eventPropGetter}
                    slotPropGetter={slotPropGetter}
                    onSelectEvent={onSelectEvent}
                    onSelectSlot={onSelectSlot}
                    onSelecting={onSelecting}
                    onNavigate={onNavigate}
                    onView={onViewChange}
                    // TODO: This should be adjustable length but for now it is fixed amount of 3 months
                    messages={{ year: '3 months' }}
                    components={{
                      toolbar: Toolbar,
                      event: Event,
                      header: ({ date, localizer }) => {
                        switch (view) {
                          case 'year':
                            return localizer.format(date, 'ddd DD MMM', '');
                          case 'week':
                            return localizer.format(date, 'dddd', '');
                          case 'month':
                            return localizer.format(date, 'dddd', '');

                          default:
                            return '';
                        }
                      },
                    }}
                  />
                }
              </Grid>
              <Grid item xs={2} className={classes.fullHeight}>
                <CalendarTodoBox
                  refreshCalendar={refresh}
                  onNewSimpleEvent={handleNewSimpleEvent}
                  proposalBookings={proposalBookings}
                />
              </Grid>
            </Grid>
            {(loadingEvents || loadingBookings) && <Loader />}
          </StyledPaper>
        </Grid>
      </Grid>
    </ContentContainer>
  );
}
