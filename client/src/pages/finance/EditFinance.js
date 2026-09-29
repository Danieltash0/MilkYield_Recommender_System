import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFinance, getFinanceRecord } from '../../api/useFinance';
import Loader from '../../components/Loader';
import FinanceForm from './FinanceForm';
import '../../styles/finance.css';

const EditFinance = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateRecord } = useFinance();
  const [initial, setInitial] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let active = true;
    getFinanceRecord(id).then((r) => {
      if (!active) return;
      setInitial(
        r && {
          record_type: r.record_type,
          category: r.category,
          amount: r.amount,
          record_date: r.record_date,
          description: r.description || '',
          cattle_id: r.cattle_id || ''
        }
      );
    });
    return () => { active = false; };
  }, [id]);

  const handleSubmit = async (form) => {
    const result = await updateRecord(id, form);
    if (result.success) navigate('/finance');
    return result;
  };

  if (initial === undefined) return <Loader />;
  if (initial === null) {
    return (
      <div className="container narrow">
        <div className="alert alert-error">Transaction not found.</div>
        <Link to="/finance" className="btn btn-outline">Back to finance</Link>
      </div>
    );
  }

  return (
    <div className="container narrow">
      <div className="page-header"><h1>Edit transaction</h1></div>
      <FinanceForm initial={initial} onSubmit={handleSubmit} submitLabel="Save changes" />
    </div>
  );
};

export default EditFinance;
