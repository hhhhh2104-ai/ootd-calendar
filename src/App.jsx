import { useEffect } from 'react';
import { useStore, startApp } from './store.js';
import { useRoute } from './router.js';
import { Toast, BusyOverlay, ConnectBanner, BottomNav, ExitDialog } from './components/ui.jsx';
import AddSheet from './components/AddSheet.jsx';
import CalendarScreen from './screens/CalendarScreen.jsx';
import DayDetailScreen from './screens/DayDetailScreen.jsx';
import UploadScreen from './screens/UploadScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import WelcomeScreen from './screens/WelcomeScreen.jsx';

export default function App() {
  const s = useStore();
  const route = useRoute();

  useEffect(() => {
    startApp();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name, route.date]);

  if (s.phase === 'loading') return <div className="splash" />;

  if (s.phase === 'welcome') {
    return (
      <>
        <WelcomeScreen />
        <ExitDialog />
        <Toast />
      </>
    );
  }

  let screen;
  if (route.name === 'day') {
    screen = <DayDetailScreen key={route.date} date={route.date} initialIndex={Number(route.query.i) || 0} />;
  } else if (route.name === 'upload') {
    screen = <UploadScreen />;
  } else if (route.name === 'settings') {
    screen = <SettingsScreen />;
  } else {
    screen = <CalendarScreen monthParam={route.query.m} />;
  }

  return (
    <div className="app">
      {!s.connected && !s.demo && <ConnectBanner />}
      {screen}
      <BottomNav active={route.name} />
      <AddSheet />
      <BusyOverlay />
      <ExitDialog />
      <Toast />
    </div>
  );
}
