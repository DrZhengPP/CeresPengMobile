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

type Screen = 'partners' | 'farms';

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
  onSelectFarm?: (partner: string, farm: string) => void;
  onClear?: () => void;
}

export default function PartnerDropdown({ onSelectFarm, onClear }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [screen, setScreen] = useState<Screen>('partners');
  const [search, setSearch] = useState('');

  // Partner state
  const [partners, setPartners] = useState<string[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);

  // Farm state
  const [farms, setFarms] = useState<string[]>([]);
  const [farmsLoading, setFarmsLoading] = useState(false);
  const [farmsError, setFarmsError] = useState<string | null>(null);
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);

  // Load partners once on mount
  useEffect(() => {
    if (!API_URL) return;
    setPartnersLoading(true);
    apiFetch<string[]>('/api/clients')
      .then((data) => { setPartners(data); setPartnersError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setPartnersError(e.message); })
      .finally(() => setPartnersLoading(false));
  }, []);

  // Load farms when a partner is selected
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

  function openModal() {
    setScreen('partners');
    setSearch('');
    setModalVisible(true);
  }

  function handlePartnerPress(partner: string) {
    setSelectedPartner(partner);
    setSelectedFarm(null);
    setSearch('');
    setScreen('farms');
  }

  function handleFarmPress(farm: string) {
    setSelectedFarm(farm);
    setModalVisible(false);
    setSearch('');
    onSelectFarm?.(selectedPartner!, farm);
  }

  function handleBackToPartners() {
    setScreen('partners');
    setSearch('');
  }

  function handleClear() {
    setSelectedPartner(null);
    setSelectedFarm(null);
    setSearch('');
    onClear?.();
  }

  // Trigger label
  const triggerLabel = selectedFarm
    ? `${selectedPartner} › ${selectedFarm}`
    : selectedPartner
    ? selectedPartner
    : null;

  const filteredPartners = search.trim()
    ? partners.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : partners;

  const filteredFarms = search.trim()
    ? farms.filter((f) => f.toLowerCase().includes(search.toLowerCase()))
    : farms;

  return (
    <>
      {/* ── Trigger button ── */}
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

      {/* ── Bottom-sheet modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (screen === 'farms') { handleBackToPartners(); } else { setModalVisible(false); }
        }}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            {screen === 'farms' ? (
              <Pressable onPress={handleBackToPartners} style={styles.backBtn} hitSlop={8}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            ) : (
              <View style={styles.backBtn} />
            )}
            <Text style={styles.sheetTitle}>
              {screen === 'partners' ? 'Select Partner' : selectedPartner!}
            </Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder={screen === 'partners' ? 'Search partners…' : 'Search farms…'}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />

          {/* List */}
          {screen === 'partners' ? (
            partnersError ? (
              <Text style={styles.errorText}>Failed to load: {partnersError}</Text>
            ) : (
              <FlatList
                data={filteredPartners}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.item, item === selectedPartner && styles.itemSelected]}
                    onPress={() => handlePartnerPress(item)}
                  >
                    <Text style={[styles.itemText, item === selectedPartner && styles.itemTextSelected]}>
                      {item}
                    </Text>
                    <Text style={styles.itemChevron}>›</Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  partnersLoading
                    ? <ActivityIndicator style={{ marginTop: 24 }} color="#6b7280" />
                    : <Text style={styles.emptyText}>No partners found</Text>
                }
              />
            )
          ) : (
            farmsError ? (
              <Text style={styles.errorText}>Failed to load: {farmsError}</Text>
            ) : (
              <FlatList
                data={filteredFarms}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.item, item === selectedFarm && styles.itemSelected]}
                    onPress={() => handleFarmPress(item)}
                  >
                    <Text style={[styles.itemText, item === selectedFarm && styles.itemTextSelected]}>
                      {item}
                    </Text>
                  </Pressable>
                )}
                ListEmptyComponent={
                  farmsLoading
                    ? <ActivityIndicator style={{ marginTop: 24 }} color="#6b7280" />
                    : <Text style={styles.emptyText}>No farms found</Text>
                }
              />
            )
          )}
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
    maxHeight: '60%',
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
