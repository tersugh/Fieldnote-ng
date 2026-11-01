import { useEffect, useLayoutEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { applyReminderPick, localRecheck, reminderDraft, type Checklist } from './caseActions';

export type ActionChange =
  | { kind: 'create' }
  | { kind: 'progress'; progress: { state: string; note: string }[] }
  | { kind: 'reminder'; value: string | null };

export function CaseActions({ checklist, hasSteps, recheckAt, disabled, language, onSave, openSection, checklistRef, reminderRef, onLayout }: {
  checklist?: Checklist; hasSteps: boolean; recheckAt?: string | null; disabled: boolean; language: 'en' | 'ha';
  onSave: (change: ActionChange) => Promise<void>;
  openSection?: { section: string; token: number };
  checklistRef?: RefObject<ComponentRef<typeof View> | null>;
  reminderRef?: RefObject<ComponentRef<typeof View> | null>;
  onLayout?: () => void;
}) {
  const [items, setItems] = useState(checklist?.items || []);
  const [time, setTime] = useState(() => reminderDraft(recheckAt));
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [editingReminder, setEditingReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageSection, setMessageSection] = useState<'checklist' | 'reminder'>('checklist');
  const savingRef = useRef(false);
  const blocked = disabled || saving;
  const [message, setMessage] = useState('');
  const snapshot = JSON.stringify(checklist);
  useEffect(() => { setItems(checklist?.items || []); }, [snapshot]);
  useEffect(() => { setTime(reminderDraft(recheckAt)); }, [recheckAt]);
  useLayoutEffect(() => {
    if (openSection?.section === 'checklist') setEditingChecklist(true);
    if (openSection?.section === 'reminder') setEditingReminder(true);
  }, [openSection]);
  const label = (en: string, ha: string) => language === 'ha' ? ha : en;
  const save = async (change: ActionChange) => {
    if (savingRef.current || disabled) return;
    savingRef.current = true;
    setSaving(true);
    setMessageSection(change.kind === 'reminder' ? 'reminder' : 'checklist');
    setMessage(label('Saving on this device…', 'Ana ajiyewa a wannan na’ura…'));
    try {
      await onSave(change);
      if (change.kind === 'progress') setEditingChecklist(false);
      if (change.kind === 'create') setEditingChecklist(true);
      if (change.kind === 'reminder') setEditingReminder(false);
      setMessage(label('Saved on this device.', 'An ajiye a wannan na’ura.'));
    } catch (error) {
      if (change.kind === 'reminder') setEditingReminder(true);
      else setEditingChecklist(true);
      setMessage(label('Could not save. Your entries remain here; tap save to retry. ', 'Ba a iya ajiyewa ba. Bayanan suna nan; sake gwadawa. ') + (error instanceof Error ? error.message : ''));
    } finally { savingRef.current = false; setSaving(false); }
  };
  const pick = (mode: 'date' | 'time') => {
    if (blocked) return;
    const failed = () => { setMessageSection('reminder'); setMessage(label('Could not open the picker. Try again.', 'Ba a iya buɗewa ba. Sake gwadawa.')); };
    try {
      DateTimePickerAndroid.open({ value: time, mode,
        onValueChange: (_event, selected) => setTime(current => applyReminderPick(current, mode, 'set', selected)),
        onDismiss: () => {}, onError: failed,
      });
    } catch { failed(); }
  };
  const button = (text: string, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: blocked, busy: saving }} disabled={blocked} onPress={onPress} style={({ pressed }) => [s.button, pressed && s.pressed, blocked && s.disabled]}><Text>{text}</Text></Pressable>;
  const stateLabel = (state: string) => state === 'todo' ? label('To do', 'A yi') : state === 'done' ? label('Done', 'An yi') : label('Skipped', 'An tsallake');
  return <View style={s.box} onLayout={onLayout}>
    <View ref={checklistRef} collapsable={false} onLayout={onLayout}>
    <Text style={s.heading}>{label('Action checklist', 'Jerin ayyuka')}</Text>
    <Text style={s.text}>{label('Saved advice wording stays unchanged. Save progress after editing; no AI request is made.', 'Kalmomin shawarar da aka ajiye ba za su canza ba. Ajiye ci gaba bayan gyara; ba a aika wa AI.')} </Text>
    {!checklist && hasSteps && button(label('Save these steps as a checklist', 'Ajiye waɗannan matakai a jeri'), () => { void save({ kind: 'create' }); })}
    {!checklist && !hasSteps && <Text style={s.text}>{label('No saved advice steps for this visit yet.', 'Babu matakan shawara da aka ajiye don wannan ziyara tukuna.')}</Text>}
    {checklist && !editingChecklist && <>
      {checklist.items.map((item, index) => <View key={index} style={s.item}><Text style={s.text}>{index + 1}. {item.text}</Text><Text style={s.text}>{stateLabel(item.state)}{item.note ? ' · ' + item.note : ''}</Text></View>)}
      {button(label('Edit checklist', 'Gyara jerin ayyuka'), () => { setItems(checklist.items); setEditingChecklist(true); setMessage(''); })}
    </>}
    {checklist && editingChecklist && items.map((item, index) => <View key={index} style={s.item}>
      <Text style={s.text}>{index + 1}. {item.text}</Text>
      <View style={s.row}>{(['todo', 'done', 'skipped'] as const).map(state => <Pressable key={state} accessibilityRole="radio" accessibilityState={{ checked: item.state === state, disabled: blocked }} disabled={blocked} style={({ pressed }) => [s.button, item.state === state && s.selected, pressed && s.pressed, blocked && s.disabled]} onPress={() => setItems(current => current.map((entry, i) => i === index ? { ...entry, state } : entry))}>
        <Text>{state === 'todo' ? label('To do', 'A yi') : state === 'done' ? label('Done', 'An yi') : label('Skipped', 'An tsallake')}</Text>
      </Pressable>)}</View>
      <TextInput editable={!blocked} accessibilityLabel={label('Optional note for step ', 'Bayanan mataki ') + (index + 1)} placeholder={label('Optional note (300 characters)', 'Bayani na zaɓi (haruffa 300)')} maxLength={300} value={item.note} onChangeText={note => setItems(current => current.map((entry, i) => i === index ? { ...entry, note } : entry))} style={s.input} />
    </View>)}
    {checklist && editingChecklist && button(label('Save progress', 'Ajiye ci gaba'), () => { void save({ kind: 'progress', progress: items }); })}
    {messageSection === 'checklist' && <>{saving && <ActivityIndicator color="#214e37" />}<Text accessibilityLiveRegion="polite" style={s.text}>{message}</Text></>}
    </View>
    <View ref={reminderRef} collapsable={false} onLayout={onLayout}>
    <Text style={s.heading}>{label('Recheck reminder', 'Tunatarwar sake dubawa')}</Text>
    <Text style={s.text}>{label('Choose your own local date and time. Reminders appear in this app only; phone notifications are not installed. No notification permission is needed.', 'Zaɓi kwanan wata da lokacin yankinka. Tunatarwa tana bayyana a cikin wannan manhaja kawai; babu sanarwar waya.')}</Text>
    {!!recheckAt && <Text style={s.text}>{label('Saved reminder: ', 'Tunatarwar da aka ajiye: ')}{new Date(recheckAt).toLocaleString()}</Text>}
    {editingReminder ? <>
      {button(label('Date: ', 'Kwanan wata: ') + time.toLocaleDateString(), () => pick('date'))}
      {button(label('Time: ', 'Lokaci: ') + time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), () => pick('time'))}
      {button(label('Save reminder', 'Ajiye tunatarwa'), () => { void save({ kind: 'reminder', value: localRecheck(time.toISOString()) }); })}
    </> : button(recheckAt ? label('Change reminder', 'Canza tunatarwa') : label('Set reminder', 'Saita tunatarwa'), () => { setTime(reminderDraft(recheckAt)); setEditingReminder(true); setMessage(''); })}
    {!!recheckAt && button(label('Dismiss reminder', 'Soke tunatarwa'), () => { void save({ kind: 'reminder', value: null }); })}
    {messageSection === 'reminder' && <>{saving && <ActivityIndicator color="#214e37" />}<Text accessibilityLiveRegion="polite" style={s.text}>{message}</Text></>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  box: { borderTopWidth: 1, borderTopColor: '#dfe5dc', marginTop: 16, paddingTop: 16 },
  heading: { color: '#214e37', fontSize: 16, fontWeight: '700', marginVertical: 10 },
  text: { color: '#384a3d', fontSize: 12, lineHeight: 20 },
  item: { marginVertical: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { minHeight: 44, padding: 12, marginVertical: 4, borderRadius: 8, backgroundColor: '#edf3ea' },
  pressed: { backgroundColor: '#cbdcc5' }, disabled: { opacity: 0.55 },
  selected: { borderColor: '#214e37', borderWidth: 2 },
  input: { padding: 12, borderWidth: 1, borderColor: '#dce3da', borderRadius: 8, backgroundColor: '#fff', color: '#1e2e25' },
});
