
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
        Go back to Home
      </Link>
    </div>
  );
}
