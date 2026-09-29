import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppointments } from '../../api/useHealth';
import AppointmentForm, { emptyAppointment } from './AppointmentForm';
import '../../styles/health.css';

// /appointments/add?cattle=3 preselects an animal (used from the cattle profile)
const AddAppointment = () => {
  const { createAppointment } = useAppointments({ upcoming: 1 });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = { ...emptyAppointment(), cattle_id: params.get('cattle') || '' };

  const handleSubmit = async (form) => {
    const result = await createAppointment(form);
    if (result.success) navigate('/appointments');
    return result;
  };

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Schedule appointment</h1></div>
      <AppointmentForm initial={initial} onSubmit={handleSubmit} submitLabel="Schedule" />
    </div>
  );
};

export default AddAppointment;
