export default function HomePage() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Audibook Studio</h1>
      <nav>
        <ul>
          <li>
            <a href="/upload">Upload EPUB</a>
          </li>
          <li>
            <a href="/books">View Books</a>
          </li>
          <li>
            <a href="/queue">Queue Monitor</a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
