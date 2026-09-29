import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMilking, getMilkingRecord } from '../../api/useMilking';
import Loader from '../../components/Loader';
import MilkingForm from './MilkingForm';
import '../../styles/tables.css';
import '../../styles/milking.css';

const EditMilking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateRecord } = useMilking();
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getMilkingRecord(id).then((r) => {
      if (!active) return;
      setInitial(
        r && {
          cattle_id: r.cattle_id,
          milking_date: r.milking_date,
          session: r.session,
          quantity: r.quantity,
          fat_percentage: r.fat_percentage ?? '',
          notes: r.notes || ''
        }
      );
    });
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateRecord(id, form);
    if (result.success) navigate('/milking');
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Milking record not found.</div>
        <Link to="/milking" className="btn btn-outline">Back to milking</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit milking record</h1></div>
      <MilkingForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
};

export default EditMilking;
