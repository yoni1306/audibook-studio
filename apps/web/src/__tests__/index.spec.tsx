import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock CSS.supports for Material-UI compatibility in Node.js environment
Object.defineProperty(global, 'CSS', {
  value: {
    supports: vi.fn(() => false),
  },
  writable: true,
});

// Mock the Material-UI DataGrid component that causes CSS import issues
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <div data-testid="mocked-datagrid" {...props}>{children}</div>,
  GridColDef: {},
  GridSortModel: {},
  GridToolbar: () => <div data-testid="mocked-grid-toolbar" />,
}));

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render without crashing', () => {
    expect(() => {
      render(
        <BrowserRouter>
          <App />
        </BrowserRouter>
      );
    }).not.toThrow();
  });
});
