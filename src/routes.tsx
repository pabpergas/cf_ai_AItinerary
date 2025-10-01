import { createBrowserRouter } from 'react-router-dom';
import App from './app';
import SharedItinerary from './pages/SharedItinerary';
import ErrorPage from './pages/ErrorPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/chat/:conversationId',
    element: <App />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/share/:itineraryId',
    element: <SharedItinerary />,
    errorElement: <ErrorPage />,
  },
]);
