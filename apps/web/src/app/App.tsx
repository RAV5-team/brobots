import { RouterProvider, createBrowserRouter } from 'react-router'
import { routes } from './router'

const router = createBrowserRouter(routes)

export function App() {
  return <RouterProvider router={router} />
}
