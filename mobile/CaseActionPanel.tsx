import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { localRecheck, type Checklist } from './caseActions';

export type ActionChange =
  | { kind: 'create' }
  | { kind: 'progress'; progress: { state: string; note: string }[] }
  | { kind: 'reminder'; value: string | null };

export function CaseActions({ checklist, hasSteps, recheckAt, disabled, language, onSave }: {
  checklist?: Checklist; hasSteps: boolean; recheckAt?: string | null; disabled: boolean; language: 'en' | 'ha';
  onSave: (change: ActionChange) => Promise<void>;
}) {
  const [items, setItems] = useState(checklist?.items || []);
  const [time, setTime] = useState(localRecheck(recheckAt).replace('T', ' '));
  const [message, setMessage] = useState('');
  const snapshot = JSON.stringify(checklist);
  useEffect(() => { setItems(checklist?.items || []); }, [snapshot]);
  useEffect(() => { setTime(localRecheck(recheckAt).replace('T', ' ')); }, [recheckAt]);
  const label = (en: string, ha: string) => language === 'ha' ? ha : en;
  const save = async (change: ActionChange) => {
    try { await onSave(change); setMessage(label('Saved on this device.', 'An ajiye a wannan na’ura.')); }
    catch (error) { setMessage(error instanceof Error ? error.message : label('Could not save. Your edits remain here.', 'Ba a iya ajiyewa ba.')); }
  };
  return <View style={s.box}>
    <Text style={s.heading}>{label('Action checklist', 'Jerin ayyuka')}</Text>
    <Text style={s.text}>{label('Saved advice wording stays unchanged. Save progress after editing; no AI request is made.', 'Kalmomin shawarar da aka ajiye ba za su canza ba. Ajiye ci gaba bayan gyara; ba a aika wa AI.')} </Text>
    {!checklist && hasSteps && <Pressable disabled={disabled} onPress={() => save({ kind: 'create' })} style={s.button}><Text>{label('Save these steps as a checklist', 'Ajiye waɗannan matakai a jeri')}</Text></Pressable>}
    {!checklist && !hasSteps && <Text style={s.text}>{label('No saved advice steps for this visit yet.', 'Babu matakan shawara da aka ajiye don wannan ziyara tukuna.')}</Text>}
    {checklist && items.map((item, index) => <View key={index} style={s.item}>
      <Text style={s.text}>{index + 1}. {item.text}</Text>
      <View style={s.row}>{(['todo', 'done', 'skipped'] as const).map(state => <Pressable key={state} accessibilityRole="radio" accessibilityState={{ checked: item.state === state, disabled }} disabled={disabled} style={[s.button, item.state === state && s.selected]} onPress={() => setItems(current => current.map((entry, i) => i === index ? { ...entry, state } : entry))}>
        <Text>{state === 'todo' ? label('To do', 'A yi') : state === 'done' ? label('Done', 'An yi') : label('Skipped', 'An tsallake')}</Text>
      </Pressable>)}</View>
      <TextInput editable={!disabled} accessibilityLabel={label('Optional note for step ', 'Bayanan mataki ') + (index + 1)} placeholder={label('Optional note (300 characters)', 'Bayani na zaɓi (haruffa 300)')} maxLength={300} value={item.note} onChangeText={note => setItems(current => current.map((entry, i) => i === index ? { ...entry, note } : entry))} style={s.input} />
    </View>)}
    {checklist && <Pressable disabled={disabled} onPress={() => save({ kind: 'progress', progress: items })} style={s.button}><Text>{label('Save progress', 'Ajiye ci gaba')}</Text></Pressable>}
    <Text style={s.heading}>{label('Recheck reminder', 'Tunatarwar sake dubawa')}</Text>
    <Text style={s.text}>{label('Choose your own local date and time. Reminders appear in this app only; phone notifications are not installed. No notification permission is needed.', 'Zaɓi kwanan wata da lokacin yankinka. Tunatarwa tana bayyana a cikin wannan manhaja kawai; babu sanarwar waya.')}</Text>
    <TextInput editable={!disabled} accessibilityLabel={label('Local recheck date and time', 'Kwanan wata da lokacin sake dubawa')} placeholder="YYYY-MM-DD HH:mm" value={time} onChangeText={setTime} style={s.input} />
    <Pressable disabled={disabled} onPress={() => save({ kind: 'reminder', value: time })} style={s.button}><Text>{label('Set / change reminder', 'Saita / canza tunatarwa')}</Text></Pressable>
    {!!recheckAt && <Pressable disabled={disabled} onPress={() => save({ kind: 'reminder', value: null })} style={s.button}><Text>{label('Dismiss reminder', 'Soke tunatarwa')}</Text></Pressable>}
    <Text accessibilityLiveRegion="polite" style={s.text}>{message}</Text>
  </View>;
}
const s = StyleSheet.create({
  box: { borderTopWidth: 1, borderTopColor: '#dfe5dc', marginTop: 16, paddingTop: 16 },
  heading: { color: '#214e37', fontSize: 16, fontWeight: '700', marginVertical: 10 },
  text: { color: '#384a3d', fontSize: 12, lineHeight: 20 },
  item: { marginVertical: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: { minHeight: 44, padding: 12, marginVertical: 4, borderRadius: 8, backgroundColor: '#edf3ea' },
  selected: { borderColor: '#214e37', borderWidth: 2 },
  input: { padding: 12, borderWidth: 1, borderColor: '#dce3da', borderRadius: 8, backgroundColor: '#fff', color: '#1e2e25' },
});
