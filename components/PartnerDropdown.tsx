import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

type Screen = 'partners' | 'farms' | 'dates';

async function apiFetch<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

interface Props {
  onSelectDate?: (partner: string, farm: string, date: string) => void;
  onClear?: () => void;
}

export default function PartnerDropdown({ onSelectDate, onClear }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [screen, setScreen] = useState<Screen>('partners');
  const [search, setSearch] = useState('');

  const [partners, setPartners] = useState<string[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  const [farms, setFarms] = useState<string[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [farmsError, setFarmsError] = useState<string | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  const [dates, setDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [datesError, setDatesError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Load partners once
  useEffect(() => {
    if (!API_URL) return;
    setPartnersLoading(true);
    apiFetch<string[]>('/api/clients')
      .then((data) => { setPartners(data); setPartnersError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setPartnersError(e.message); })
      .finally(() => setPartnersLoading(false));
  }, []);

  // Load farms when partner selected
  useEffect(() => {
    if (!selectedPartner) return;
    setFarmsLoading(true);
    setFarms([]);
    setFarmsError(null);
    apiFetch<string[]>(`/api/farms/${encodeURIComponent(selectedPartner)}`)
      .then((data) => { setFarms(data); setFarmsError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setFarmsError(e.message); })
      .finally(() => setFarmsLoading(false));
  }, [selectedPartner]);

  // Load dates when farm selected
  useEffect(() => {
    if (!selectedPartner || !selectedFarm) return;
    setDatesLoading(true);
    setDates([]);
    setDatesError(null);
    apiFetch<string[]>(
      `/api/dates/${encodeURIComponent(selectedPartner)}/${encodeURIComponent(selectedFarm)}`
    )
      .then((data) => { setDates(data); setDatesError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setDatesError(e.message); })
      .finally(() => setDatesLoading(false));
  }, [selectedPartner, selectedFarm]);

  function openModal() {
    setScreen('partners');
    setSearch('');
    setModalVisible(true);
  }

  function handlePartnerPress(partner: string) {
    setSelectedPartner(partner);
    setSelectedFarm(null);
    setSelectedDate(null);
    setSearch('');
    setScreen('farms');
  }

  function handleFarmPress(farm: string) {
    setSelectedFarm(farm);
    setSelectedDate(null);
    setSearch('');
    setScreen('dates');
  }

  function handleDatePress(date: string) {
    setSelectedDate(date);
    setModalVisible(false);
    setSearch('');
    onSelectDate?.(selectedPartner!, selectedFarm!, date);
  }

  function handleBack() {
    setSearch('');
    if (screen === 'dates') setScreen('farms');
    else if (screen === 'farms') setScreen('partners');
  }

  function handleClear() {
    setSelectedPartner(null);
    setSelectedFarm(null);
    setSelectedDate(null);
    setSearch('');
    onClear?.();
  }

  // Trigger label
  const triggerLabel = selectedDate
    ? `${selectedFarm} · ${selectedDate}`
    : selectedFarm
    ? `${selectedPartner} › ${selectedFarm}`
    : selectedPartner ?? null;

  const filtered = {
    partners: search.trim()
      ? partners.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
      : partners,
    farms: search.trim()
      ? farms.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
      : farms,
    dates: search.trim()
      ? dates.filter((d) => d.includes(search))
      : dates,
  }[screen];

  const sheetTitle =
    screen === 'partners' ? 'Select Partner' :
    screen === 'farms' ? selectedPartner! :
    selectedFarm!;

  const placeholder =
    screen === 'partners' ? 'Search partners…' :
    screen === 'farms' ? 'Search farms…' :
    'Search dates…';

  return (
    <>
      {/* Trigger */}
      <Pressable style={styles.trigger} onPress={openModal} accessibilityRole="button">
        {partnersLoading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={[styles.triggerText, !triggerLabel && styles.placeholder]} numberOfLines={1}>
            {triggerLabel ?? 'Select partner…'}
          </Text>
        )}
        {triggerLabel ? (
          <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear selection">
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.chevron}>▾</Text>
        )}
      </Pressable>

      {/* Bottom-sheet modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (screen !== 'partners') handleBack();
          else setModalVisible(false);
        }}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            {screen !== 'partners' ? (
              <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text style={styles.sheetTitle} numberOfLines={1}>{sheetTitle}</Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Breadcrumb on farms/dates screens */}
          {screen !== 'partners' && (
            <Text style={styles.breadcrumb} numberOfLines={1}>
              {screen === 'farms'
                ? selectedPartner
                : `${selectedPartner} › ${selectedFarm}`}
            </Text>
          )}

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />

          {/* List */}
          {(() => {
            const isLoading =
              (screen === 'partners' && partnersLoading) ||
              (screen === 'farms' && farmsLoading) ||
              (screen === 'dates' && datesLoading);
            const error =
              screen === 'partners' ? partnersError :
              screen === 'farms' ? farmsError :
              datesError;
            const selected =
              screen === 'partners' ? selectedPartner :
              screen === 'farms' ? selectedFarm :
              selectedDate;
            const showChevron = screen !== 'dates';

            if (error) return <Text style={styles.errorText}>Failed to load: {error}</Text>;

            return (
              <FlatList
                data={filtered as string[]}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.item, item === selected && styles.itemSelected]}
                    onPress={() =>
                      screen === 'partners' ? handlePartnerPress(item) :
                      screen === 'farms' ? handleFarmPress(item) :
                      handleDatePress(item)
                    }
                  >
                    <Text style={[styles.itemText, item === selected && styles.itemTextSelected]}>
                      {item}
                    </Text>
                    {showChevron && <Text style={styles.itemChevron}>›</Text>}
                  </Pressable>
                )}
                ListEmptyComponent={
                  isLoading
                    ? <ActivityIndicator style={{ marginTop: 24 }} color="#6b7280" />
                    : <Text style={styles.emptyText}>No results found</Text>
                }
              />
            );
          })()}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  placeholder: {
    color: '#9ca3af',
  },
  chevron: {
    fontSize: 12,
    color: '#6b7280',
  },
  clearBtn: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 2,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 56,
  },
  backText: {
    fontSize: 15,
    color: '#2563eb',
    fontWeight: '500',
  },
  sheetTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  closeBtn: {
    width: 56,
    alignItems: 'flex-end',
  },
  closeText: {
    fontSize: 14,
    color: '#6b7280',
  },
  breadcrumb: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  searchInput: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    fontSize: 14,
    color: '#111827',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  itemSelected: {
    backgroundColor: '#eff6ff',
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  itemTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  itemChevron: {
    fontSize: 16,
    color: '#9ca3af',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 24,
    fontSize: 14,
  },
  errorText: {
    textAlign: 'center',
    color: '#ef4444',
    marginTop: 24,
    fontSize: 13,
    paddingHorizontal: 20,
  },
});
