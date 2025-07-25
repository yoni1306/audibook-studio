
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BooksPage from './pages/BooksPage';
import BookDetailPage from './pages/BookDetailPage';
import BookExportPage from './pages/BookExportPage';
import CorrectionsPage from './pages/CorrectionsPage';
import UploadPage from './pages/UploadPage';
import QueuePage from './pages/QueuePage';
import TextFixesPage from './pages/TextFixesPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/books" element={<BooksPage />} />
        <Route path="/books/:id" element={<BookDetailPage />} />
        <Route path="/books/:id/export" element={<BookExportPage />} />
        <Route path="/corrections" element={<CorrectionsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/text-fixes" element={<TextFixesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
