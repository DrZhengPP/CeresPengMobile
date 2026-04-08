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

type Screen = 'partners' | 'farms' | 'dates' | 'products';

// Human-readable labels for product column names
const PRODUCT_LABELS: Record<string, string> = {
  Raw:       'Raw',
  NDVI:      'NDVI',
  NDVI_norm: 'NDVI (Normalised)',
  GNDVI:     'GNDVI',
  GNDVI_norm:'GNDVI (Normalised)',
  NDRE:      'NDRE',
  NDRE_norm: 'NDRE (Normalised)',
  NDMI:      'NDMI',
  NDMI_norm: 'NDMI (Normalised)',
  Change:    'Change Detection',
};

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

export interface Selection {
  partner: string;
  farm: string;
  date: string;
  product: string;
}

interface Props {
  onSelect?: (selection: Selection) => void;
  onClear?: () => void;
}

export default function PartnerDropdown({ onSelect, onClear }: Props) {
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

  const [products, setProducts] = useState<string[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (!API_URL) return;
    setPartnersLoading(true);
    apiFetch<string[]>('/api/clients')
      .then((d) => { setPartners(d); setPartnersError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setPartnersError(e.message); })
      .finally(() => setPartnersLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPartner) return;
    setFarmsLoading(true); setFarms([]); setFarmsError(null);
    apiFetch<string[]>(`/api/farms/${encodeURIComponent(selectedPartner)}`)
      .then((d) => { setFarms(d); setFarmsError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setFarmsError(e.message); })
      .finally(() => setFarmsLoading(false));
  }, [selectedPartner]);

  useEffect(() => {
    if (!selectedPartner || !selectedFarm) return;
    setDatesLoading(true); setDates([]); setDatesError(null);
    apiFetch<string[]>(
      `/api/dates/${encodeURIComponent(selectedPartner)}/${encodeURIComponent(selectedFarm)}`
    )
      .then((d) => { setDates(d); setDatesError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setDatesError(e.message); })
      .finally(() => setDatesLoading(false));
  }, [selectedPartner, selectedFarm]);

  useEffect(() => {
    if (!selectedPartner || !selectedFarm || !selectedDate) return;
    setProductsLoading(true); setProducts([]); setProductsError(null);
    apiFetch<string[]>(
      `/api/products/${encodeURIComponent(selectedPartner)}/${encodeURIComponent(selectedFarm)}/${encodeURIComponent(selectedDate)}`
    )
      .then((d) => { setProducts(d); setProductsError(null); })
      .catch((e: Error) => { if (e.name !== 'AbortError') setProductsError(e.message); })
      .finally(() => setProductsLoading(false));
  }, [selectedPartner, selectedFarm, selectedDate]);

  function openModal() {
    setScreen('partners');
    setSearch('');
    setModalVisible(true);
  }

  function handlePartnerPress(p: string) {
    setSelectedPartner(p); setSelectedFarm(null); setSelectedDate(null); setSelectedProduct(null);
    setSearch(''); setScreen('farms');
  }
  function handleFarmPress(f: string) {
    setSelectedFarm(f); setSelectedDate(null); setSelectedProduct(null);
    setSearch(''); setScreen('dates');
  }
  function handleDatePress(d: string) {
    setSelectedDate(d); setSelectedProduct(null);
    setSearch(''); setScreen('products');
  }
  function handleProductPress(prod: string) {
    setSelectedProduct(prod);
    setModalVisible(false); setSearch('');
    onSelect?.({ partner: selectedPartner!, farm: selectedFarm!, date: selectedDate!, product: prod });
  }
  function handleBack() {
    setSearch('');
    if (screen === 'products') setScreen('dates');
    else if (screen === 'dates') setScreen('farms');
    else if (screen === 'farms') setScreen('partners');
  }
  function handleClear() {
    setSelectedPartner(null); setSelectedFarm(null); setSelectedDate(null); setSelectedProduct(null);
    setSearch(''); onClear?.();
  }

  const triggerLabel = selectedProduct
    ? `${selectedFarm} · ${selectedDate} · ${PRODUCT_LABELS[selectedProduct] ?? selectedProduct}`
    : selectedDate
    ? `${selectedFarm} · ${selectedDate}`
    : selectedFarm
    ? `${selectedPartner} › ${selectedFarm}`
    : selectedPartner ?? null;

  const SCREENS: Screen[] = ['partners', 'farms', 'dates', 'products'];
  const screenIndex = SCREENS.indexOf(screen);

  const listData: string[] = (() => {
    const raw = screen === 'partners' ? partners
      : screen === 'farms' ? farms
      : screen === 'dates' ? dates
      : products;
    if (!search.trim()) return raw;
    return raw.filter((item) =>
      (PRODUCT_LABELS[item] ?? item).toLowerCase().includes(search.toLowerCase())
    );
  })();

  const isLoading = [partnersLoading, farmsLoading, datesLoading, productsLoading][screenIndex];
  const error = [partnersError, farmsError, datesError, productsError][screenIndex];
  const selectedItem = [selectedPartner, selectedFarm, selectedDate, selectedProduct][screenIndex];
  const hasChevron = screen !== 'products';
  const sheetTitle = screen === 'partners' ? 'Select Partner'
    : screen === 'farms' ? selectedPartner!
    : screen === 'dates' ? selectedFarm!
    : selectedDate!;
  const searchPlaceholder = `Search ${screen}…`;

  const breadcrumb = screen === 'farms' ? selectedPartner
    : screen === 'dates' ? `${selectedPartner} › ${selectedFarm}`
    : screen === 'products' ? `${selectedPartner} › ${selectedFarm} › ${selectedDate}`
    : null;

  return (
    <>
      <Pressable style={styles.trigger} onPress={openModal} accessibilityRole="button">
        {partnersLoading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={[styles.triggerText, !triggerLabel && styles.placeholder]} numberOfLines={1}>
            {triggerLabel ?? 'Select partner…'}
          </Text>
        )}
        {triggerLabel ? (
          <Pressable onPress={handleClear} hitSlop={8} accessibilityLabel="Clear">
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        ) : (
          <Text style={styles.chevron}>▾</Text>
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { if (screen !== 'partners') handleBack(); else setModalVisible(false); }}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>

          {/* Header */}
          <View style={styles.header}>
            {screen !== 'partners' ? (
              <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={8}>
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            ) : <View style={styles.backBtn} />}
            <Text style={styles.sheetTitle} numberOfLines={1}>{sheetTitle}</Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn} hitSlop={8}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          {/* Step indicator */}
          <View style={styles.steps}>
            {SCREENS.map((s, i) => (
              <View key={s} style={styles.stepRow}>
                <View style={[styles.stepDot, i <= screenIndex && styles.stepDotActive]} />
                {i < SCREENS.length - 1 && (
                  <View style={[styles.stepLine, i < screenIndex && styles.stepLineActive]} />
                )}
              </View>
            ))}
          </View>

          {/* Breadcrumb */}
          {breadcrumb && (
            <Text style={styles.breadcrumb} numberOfLines={1}>{breadcrumb}</Text>
          )}

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            autoFocus
            clearButtonMode="while-editing"
          />

          {/* List */}
          {error ? (
            <Text style={styles.errorText}>Failed to load: {error}</Text>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.item, item === selectedItem && styles.itemSelected]}
                  onPress={() =>
                    screen === 'partners' ? handlePartnerPress(item) :
                    screen === 'farms'    ? handleFarmPress(item) :
                    screen === 'dates'    ? handleDatePress(item) :
                    handleProductPress(item)
                  }
                >
                  <Text style={[styles.itemText, item === selectedItem && styles.itemTextSelected]}>
                    {PRODUCT_LABELS[item] ?? item}
                  </Text>
                  {hasChevron && <Text style={styles.itemChevron}>›</Text>}
                </Pressable>
              )}
              ListEmptyComponent={
                isLoading
                  ? <ActivityIndicator style={{ marginTop: 24 }} color="#6b7280" />
                  : <Text style={styles.emptyText}>No results found</Text>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0,
  },
  triggerText: { flex: 1, fontSize: 14, color: '#111827' },
  placeholder: { color: '#9ca3af' },
  chevron: { fontSize: 12, color: '#6b7280' },
  clearBtn: { fontSize: 12, color: '#6b7280', paddingHorizontal: 2 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '65%', backgroundColor: '#ffffff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 24,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  backBtn: { width: 56 },
  backText: { fontSize: 15, color: '#2563eb', fontWeight: '500' },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827', textAlign: 'center' },
  closeBtn: { width: 56, alignItems: 'flex-end' },
  closeText: { fontSize: 14, color: '#6b7280' },
  steps: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32, marginTop: 6, marginBottom: 2,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#e5e7eb',
  },
  stepDotActive: { backgroundColor: '#2563eb' },
  stepLine: { width: 24, height: 2, backgroundColor: '#e5e7eb' },
  stepLineActive: { backgroundColor: '#2563eb' },
  breadcrumb: {
    fontSize: 11, color: '#9ca3af', textAlign: 'center',
    paddingHorizontal: 20, marginBottom: 2,
  },
  searchInput: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#f3f4f6', fontSize: 14, color: '#111827',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20,
  },
  itemSelected: { backgroundColor: '#eff6ff' },
  itemText: { flex: 1, fontSize: 14, color: '#374151' },
  itemTextSelected: { color: '#2563eb', fontWeight: '600' },
  itemChevron: { fontSize: 16, color: '#9ca3af' },
  emptyText: { textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 14 },
  errorText: { textAlign: 'center', color: '#ef4444', marginTop: 24, fontSize: 13, paddingHorizontal: 20 },
});
