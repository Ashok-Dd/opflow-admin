import { Head, LoadError } from '@/components/ui';
import { load } from '@/lib/api';

import { DoctorWizard } from './wizard';

export const metadata = { title: 'Add a doctor' };

export default async function NewDoctorPage() {
  const [catalog, hospitals] = await Promise.all([
    load<{ doctorTypes: { id: string; simpleName: string; properName: string }[] }>('/v1/catalog'),
    load<{ items: { id: string; name: string; area: string; city: string; status?: string }[] }>('/v1/admin/hospitals', { limit: 50 }),
  ]);
  return (
    <>
      <Head
        kicker="Doctors · new"
        title="Add a doctor"
        lead="Six short steps. The doctor gets a login ID (OPD-…) and a one-time password, but stays hidden from patients until you verify them on the doctor page."
      />
      {catalog.error ? <LoadError error={catalog.error} /> : null}
      {hospitals.error ? <LoadError error={hospitals.error} /> : null}
      {catalog.data && hospitals.data ? (
        <DoctorWizard types={catalog.data.doctorTypes} hospitals={hospitals.data.items.filter((h) => h.status !== 'hidden')} />
      ) : null}
    </>
  );
}
