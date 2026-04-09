import { Navigate, useSearchParams } from 'react-router-dom';

export default function ExportPage() {
  const [searchParams] = useSearchParams();
  const dataTab = searchParams.get('tab') === 'import' ? 'import' : 'export';

  return <Navigate to={`/settings?section=data&dataTab=${dataTab}`} replace />;
}
