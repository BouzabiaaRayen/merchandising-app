import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DailyContext = createContext();

export const DailyProvider = ({ children }) => {
  const [timeWorked, setTimeWorked] = useState('00:00:00');
  const [progress, setProgress] = useState(0);
  const [storeVisits, setStoreVisits] = useState({ visited: 0, total: 0 });
  const [schedule, setSchedule] = useState([]);
  const [route, setRoute] = useState([]);

  // Helper to get today's date string
  const getToday = () => new Date().toISOString().slice(0, 10);

  // Reset all daily state
  const resetDailyState = async () => {
    setTimeWorked('00:00:00');
    setProgress(0);
    setStoreVisits({ visited: 0, total: 0 });
    setSchedule([]); // Or fetch today's schedule
    setRoute([]);    // Or fetch today's route
    await AsyncStorage.setItem('lastResetDate', getToday());
  };

  // On mount, check if reset is needed
  useEffect(() => {
    const checkReset = async () => {
      const lastReset = await AsyncStorage.getItem('lastResetDate');
      if (lastReset !== getToday()) {
        await resetDailyState();
      }
    };
    checkReset();
  }, []);

  // Set a timer to reset at the device's local midnight if app stays open
  useEffect(() => {
    const now = new Date();
    // Calculate local midnight (next day, 00:00:00 local time)
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // next local midnight
    const msUntilMidnight = midnight - now;
    const timer = setTimeout(() => {
      resetDailyState();
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, []);

  return (
    <DailyContext.Provider value={{
      timeWorked, setTimeWorked,
      progress, setProgress,
      storeVisits, setStoreVisits,
      schedule, setSchedule,
      route, setRoute,
      resetDailyState
    }}>
      {children}
    </DailyContext.Provider>
  );
};
