// app/index.tsx

import DateTimePicker from '@react-native-community/datetimepicker';
import mqtt from '@taoqf/react-native-mqtt';
import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function HomeScreen() {
  const [client, setClient] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [ledOn, setLedOn] = useState(false);

  // For timer UI:
  const [showTimerConfig, setShowTimerConfig] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date>(new Date());
  // daysOfWeek[0] = Sunday, [1] = Monday, ... [6] = Saturday
  const [daysOfWeek, setDaysOfWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);
  // action: true = turn ON, false = turn OFF
  const [timerActionOn, setTimerActionOn] = useState(true);

  useEffect(() => {
    const mqttUrl = 'wss://broker.emqx.io:8084/mqtt';
    const options = {
      clientId: 'rn_led_' + Math.random().toString(16).slice(2, 8),
      reconnectPeriod: 1000,
      connectTimeout: 5000,
    };

    const mqttClient = mqtt.connect(mqttUrl, options);

    mqttClient.on('connect', () => {
      console.log('✅ MQTT connected');
      setIsConnected(true);
    });

    mqttClient.on('error', (err: any) => {
      console.log('❌ MQTT connection error', err);
      mqttClient.end();
    });

    setClient(mqttClient);
    return () => {
      mqttClient.end();
    };
  }, []);

  const toggleLED = () => {
    if (client) {
      const topic = 'cmnd/messi/POWER';
      const message = ledOn ? 'OFF' : 'ON';
      client.publish(topic, message);
      setLedOn(!ledOn);
    }
  };

  /** When the user confirms the timer configuration:
   *  - Build a "Days" string like "0110010" (Sun→Sat)
   *  - Build the JSON payload with Action = 0 or 1
   *  - Publish to cmnd/messi/Timer1
   */
  const confirmTimer = () => {
    // 1) Build the 7-char "Days" string
    //    Index 0 = Sunday, 1 = Monday, …, 6 = Saturday
    let daysString = daysOfWeek.map((val) => (val ? '1' : '0')).join('');
    // If user didn't pick any day, default to all days:
    if (daysString === '0000000') {
      daysString = '1111111';
    }

    // 2) Format time as "HH:MM"
    const hours = String(selectedTime.getHours()).padStart(2, '0');
    const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // 3) Build payload
    const timerPayload = {
      Enable: 1,
      Mode: 0,              // single‐action (not sunrise/sunset)
      Time: timeString,
      Window: 0,
      Days: daysString,
      Repeat: 0,            // no repeat beyond chosen days
      Output: 1,            // POWER1
      Action: timerActionOn ? 1 : 0, // 1 = ON, 0 = OFF
    };

    client.publish('cmnd/messi/Timer1', JSON.stringify(timerPayload));

    // Hide timer UI
    setShowTimerConfig(false);
  };

  /** Called when the Android time picker returns a value (or is canceled) */
  const onTimeChange = (_event: any, date?: Date) => {
    setShowPicker(false);
    if (date) {
      setSelectedTime(date);
    }
  };

  /** Toggle a day in the daysOfWeek array */
  const toggleDay = (index: number) => {
    const updated = [...daysOfWeek];
    updated[index] = !updated[index];
    setDaysOfWeek(updated);
  };

  return (
    <ImageBackground
      source={require('../../assets/images/yarsa.png')}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Semi‐opaque overlay behind all controls for readability */}
      <View
        style={[
          styles.overlay,
          { backgroundColor: ledOn ? 'rgba(255,248,225,0.7)' : 'rgba(38,50,56,0.7)' },
        ]}
      >
        <StatusBar barStyle={ledOn ? 'dark-content' : 'light-content'} />

        <Text style={styles.title}>💡 ESmart_Switch</Text>

        {/* Flashlight-style ON/OFF button */}
        <TouchableOpacity
          style={[styles.flashlightButton, ledOn ? styles.on : styles.off]}
          onPress={toggleLED}
          disabled={!isConnected}
        >
          <Text style={styles.buttonText}>{ledOn ? 'Turn OFF' : 'Turn ON'}</Text>
        </TouchableOpacity>

        {/* Button to open timer‐config UI */}
        <TouchableOpacity
          style={styles.timerMainButton}
          onPress={() => setShowTimerConfig(!showTimerConfig)}
          disabled={!isConnected}
        >
          <Text style={styles.timerMainButtonText}>
            {showTimerConfig ? 'Cancel Timer Setup' : 'Set Timer'}
          </Text>
        </TouchableOpacity>

        {/* Timer Configuration Panel */}
        {showTimerConfig && (
          <View style={styles.timerConfigContainer}>
            {/* 1) Day selectors */}
            <Text style={styles.sectionHeader}>Select Days:</Text>
            <View style={styles.daysRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayButton,
                    daysOfWeek[idx] ? styles.daySelected : styles.dayUnselected,
                  ]}
                  onPress={() => toggleDay(idx)}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      daysOfWeek[idx] ? styles.dayLabelSelected : styles.dayLabelUnselected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 2) Time picker */}
            <TouchableOpacity
              style={styles.pickTimeButton}
              onPress={() => setShowPicker(true)}
            >
              <Text style={styles.pickTimeText}>
                Pick Time: {String(selectedTime.getHours()).padStart(2, '0')}:
                {String(selectedTime.getMinutes()).padStart(2, '0')}
              </Text>
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onTimeChange}
              />
            )}

            {/* 3) Action selector */}
            <Text style={[styles.sectionHeader, { marginTop: 20 }]}>Action:</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  timerActionOn ? styles.actionOnSelected : styles.actionUnselected,
                ]}
                onPress={() => setTimerActionOn(true)}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    timerActionOn ? styles.actionLabelSelected : styles.actionLabelUnselected,
                  ]}
                >
                  Turn ON
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  !timerActionOn ? styles.actionOffSelected : styles.actionUnselected,
                ]}
                onPress={() => setTimerActionOn(false)}
              >
                <Text
                  style={[
                    styles.actionLabel,
                    !timerActionOn ? styles.actionLabelSelected : styles.actionLabelUnselected,
                  ]}
                >
                  Turn OFF
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4) Confirm */}
            <TouchableOpacity style={styles.confirmButton} onPress={confirmTimer}>
              <Text style={styles.confirmButtonText}>Confirm Timer</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.status}>
          {isConnected ? '✅ Connected to MQTT broker' : '🔄 Connecting...'}
        </Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 70,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFEB3B',
    marginBottom: 30,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  flashlightButton: {
    width: 180,
    height: 180,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    marginBottom: 20,
  },
  on: {
    backgroundColor: '#FFEB3B',
  },
  off: {
    backgroundColor: '#607D8B',
  },
  buttonText: {
    fontSize: 22,
    color: '#000',
    fontWeight: 'bold',
  },
  timerMainButton: {
    backgroundColor: '#FFA400',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 50,
    elevation: 3,
  },
  timerMainButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },

  //  ──────────────── Timer Config ────────────────
  timerConfigContainer: {
    width: '90%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  sectionHeader: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySelected: {
    backgroundColor: '#FFEB3B',
  },
  dayUnselected: {
    backgroundColor: '#555',
  },
  dayLabel: {
    fontSize: 14,
  },
  dayLabelSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  dayLabelUnselected: {
    color: '#FFF',
  },
  pickTimeButton: {
    marginTop: 12,
    backgroundColor: '#FFA400',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  pickTimeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  actionButton: {
    width: 100,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionOnSelected: {
    backgroundColor: '#4CAF50',
  },
  actionOffSelected: {
    backgroundColor: '#F44336',
  },
  actionUnselected: {
    backgroundColor: '#555',
  },
  actionLabel: {
    fontSize: 14,
  },
  actionLabelSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  actionLabelUnselected: {
    color: '#DDD',
  },
  confirmButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  //  ─────────────────────────────────────────────────

  status: {
    fontSize: 16,
    color: 'yellow',
    marginTop: 10,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});
