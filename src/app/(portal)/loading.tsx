import { OpLoadingPanel } from '@/components/op-loader';

/** Between pages: the OPflow loader (never a blank screen). */
export default function Loading() {
  return <OpLoadingPanel text="Loading…" height={420} />;
}
