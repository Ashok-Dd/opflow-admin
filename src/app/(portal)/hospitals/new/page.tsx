import { Head, LoadError } from '@/components/ui';
import { load } from '@/lib/api';

import { createHospital } from '../../actions';
import { HospitalForm } from '../hospital-form';

export const metadata = { title: 'Add a hospital' };

export default async function NewHospitalPage() {
  const cat = await load<{ doctorTypes: { id: string; simpleName: string }[] }>('/v1/catalog');
  return (
    <>
      <Head kicker="Hospitals · new" title="Add a hospital" />
      {cat.error ? <LoadError error={cat.error} /> : (
        <div className="slip" style={{ maxWidth: 820 }}>
          <HospitalForm action={createHospital} types={cat.data.doctorTypes} submit="Add hospital" />
        </div>
      )}
    </>
  );
}
