import { useEffect } from 'react';
import useStore from './store';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ContentGrid from './components/Grid';
import ExportBar from './components/ExportBar';

export default function App() {

  useEffect(() => {
    useStore.getState().initFromLastFolder();
  }, []);

  return (
    <div className="h-screen flex bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-hidden flex flex-col">
          <ContentGrid />
          <ExportBar />
        </div>
      </main>
    </div>
  );
}
