import { useApp } from './context/AppContext.jsx'
import { CallProvider } from './context/CallProvider.jsx'
import SplashPage from './pages/SplashPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import PhoneEntryPage from './pages/PhoneEntryPage.jsx'
import PhoneOtpPage from './pages/PhoneOtpPage.jsx'
import RoleSelectPage from './pages/RoleSelectPage.jsx'
import RoleSignInPage from './pages/RoleSignInPage.jsx'
import SignInResultPage from './pages/SignInResultPage.jsx'
import HomePage from './pages/HomePage.jsx'
import Toast from './components/Toast.jsx'

const ROUTES = {
  splash: <SplashPage />,
  login: <LoginPage />,
  phone_entry: <PhoneEntryPage />,
  phone_otp: <PhoneOtpPage />,
  role_select: <RoleSelectPage />,
  role_signin: <RoleSignInPage />,
  signin_success: <SignInResultPage ok />,
  signin_fail: <SignInResultPage ok={false} />,
  home: <HomePage />,
}

export default function App() {
  const { screen } = useApp()
  const content = ROUTES[screen] || <div className="p-6">Unknown screen: {screen}</div>
  return (
    <CallProvider>
      <div className="min-h-screen text-txt-primary" style={{ background: '#F4F6FA', fontFamily: 'Montserrat, sans-serif' }}>
        <div className="min-h-screen">{content}</div>
        <Toast />
      </div>
    </CallProvider>
  )
}
