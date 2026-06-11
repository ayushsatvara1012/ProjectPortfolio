import type { Metadata } from 'next';
import EnquiryForm from './EnquiryForm';

// Transactional utility page — keep it out of the index until Explore goes live.
export const metadata: Metadata = {
  title: 'Request Explore Access — Vaayu',
  description: 'Request free access to the Vaayu Explore plan.',
  robots: { index: false, follow: false },
};

export default function ExploreEnquiryPage() {
  return <EnquiryForm />;
}
