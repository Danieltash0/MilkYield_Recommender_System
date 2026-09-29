import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppointments, getAppointment } from '../../api/useHealth';
import Loader from '../../components/Loader';
import AppointmentForm from './AppointmentForm';
import '../../styles/health.css';

const EditAppointment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateAppointment } = useAppointments({ upcoming: 1 });
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getAppointment(id).then((a) => {
      if (!active) return;
      setInitial(
        a && {
          cattle_id: a.cattle_id,
          vet_id: a.vet_id || '',
          // 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM' for the datetime-local input
          appointment_date: a.appointment_date.slice(0, 16).replace(' ', 'T'),
          reason: a.reason,
          notes: a.notes || ''
        }
      );
    });
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateAppointment(id, form);
    if (result.success) navigate('/appointments');
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Appointment not found.</div>
        <Link to="/appointments" className="btn btn-outline">Back to appointments</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit appointment</h1></div>
      <AppointmentForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" isNew={false} />
    </div>
  );
};

export default EditAppointment;
