import MaterialTable, { Column } from '@material-table/core';
import { Button, makeStyles } from '@material-ui/core';
import { Add as AddIcon } from '@material-ui/icons';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';
import { useSnackbar } from 'notistack';
import React, { useState, Dispatch, SetStateAction, useEffect } from 'react';

import Loader from 'components/common/Loader';
import { tableIcons } from 'components/common/TableIcons';
import SelectEquipmentDialog from 'components/timeSlotBooking/equipmentBooking/SelectEquipmentDialog';
import {
  EquipmentAssignmentStatus,
  ProposalBookingStatusCore,
  ScheduledEvent,
} from 'generated/sdk';
import { useDataApi } from 'hooks/common/useDataApi';
import { ScheduledEventEquipment } from 'hooks/scheduledEvent/useScheduledEventWithEquipment';

export type EquipmentTableRow = {
  id: string;
  name: string;
  autoAccept: boolean;
};

const useStyles = makeStyles((theme) => ({
  root: {
    '& .MuiToolbar-root button.MuiIconButton-root': {
      backgroundColor: 'unset !important',
      padding: 0,
    },
  },
  spacingTop: {
    marginTop: theme.spacing(2),
  },
}));

type TimeSlotEquipmentBookingTableProps = {
  scheduledEvent: ScheduledEvent;
  proposalBookingId: number;
  loadingEquipments: boolean;
  scheduledEventEquipments: ScheduledEventEquipment[];
  allEquipmentsAccepted: boolean;
  setAllEquipmentsAccepted: Dispatch<SetStateAction<boolean>>;
};

export default function TimeSlotEquipmentBookingTable({
  scheduledEventEquipments,
  scheduledEvent,
  proposalBookingId,
  loadingEquipments,
  allEquipmentsAccepted,
  setAllEquipmentsAccepted,
}: TimeSlotEquipmentBookingTableProps) {
  const [equipments, setEquipments] = useState(scheduledEventEquipments);
  const isStepReadOnly =
    scheduledEvent.status !== ProposalBookingStatusCore.DRAFT;

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [equipmentDialog, setEquipmentDialog] = useState(false);

  useEffect(() => {
    const allAccepted = equipments.every(
      (equipment) => equipment.status === EquipmentAssignmentStatus.ACCEPTED
    );

    setAllEquipmentsAccepted(allAccepted);
  }, [equipments, setAllEquipmentsAccepted]);

  const columns: Column<ScheduledEventEquipment>[] = [
    {
      title: 'Name',
      field: 'name',
    },
    {
      title: 'Description',
      field: 'description',
    },
    { title: 'Status', field: 'status' },
  ];

  const handleEquipmentCloseDialog = (
    assignedEquipments?: ScheduledEventEquipment[]
  ) => {
    if (assignedEquipments) {
      const newEquipments = [...equipments, ...assignedEquipments];

      setEquipments(newEquipments);
    }
    setEquipmentDialog(false);
  };

  const api = useDataApi();

  const handleDeleteAssignment = async (equipmentId: number) => {
    setLoading(true);

    const { deleteEquipmentAssignment: success } =
      await api().deleteEquipmentAssignment({
        deleteEquipmentAssignmentInput: {
          equipmentId,
          scheduledEventId: scheduledEvent.id,
          proposalBookingId: proposalBookingId,
        },
      });

    if (success) {
      enqueueSnackbar('Removed', { variant: 'success' });
      const newEquipments = equipments.filter(
        (equipment) => equipment.id !== equipmentId
      );
      setEquipments(newEquipments);
    } else {
      enqueueSnackbar('Failed to remove selected assignment', {
        variant: 'error',
      });
    }

    setLoading(false);
  };

  return (
    <div className={classes.root} data-cy="time-slot-booked-equipments-table">
      {loading && <Loader />}

      {equipmentDialog && (
        <SelectEquipmentDialog
          isDialogOpen={equipmentDialog}
          closeDialog={(assignedEquipments?: ScheduledEventEquipment[]) =>
            handleEquipmentCloseDialog(assignedEquipments)
          }
          scheduledEvent={scheduledEvent}
        />
      )}
      <MaterialTable
        icons={tableIcons}
        title="Time slot equipments"
        isLoading={loadingEquipments}
        columns={columns}
        data={equipments}
        options={{
          search: false,
          paging: false,
        }}
        editable={
          !isStepReadOnly
            ? {
                onRowDelete: (data) => handleDeleteAssignment(data.id),
              }
            : {}
        }
        actions={[
          {
            icon: () => (
              <Button
                variant="contained"
                color="primary"
                component="span"
                data-cy="btn-book-equipment"
                startIcon={<AddIcon />}
                disabled={equipmentDialog}
              >
                Book equipment
              </Button>
            ),
            disabled: equipmentDialog,
            onClick: () => setEquipmentDialog(true),
            isFreeAction: true,
            hidden: isStepReadOnly,
            tooltip: !equipmentDialog ? 'Book equipment' : '',
          },
        ]}
      />
      {!allEquipmentsAccepted && (
        <Alert
          severity="warning"
          className={classes.spacingTop}
          data-cy="accepted-equipment-warning"
        >
          <AlertTitle>Warning</AlertTitle>
          All booked equipments must be accepted before activating the booking
        </Alert>
      )}
    </div>
  );
}
