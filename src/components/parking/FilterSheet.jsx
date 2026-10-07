import Sheet from '@/components/ui/Sheet'
import Button from '@/components/ui/Button'
import Chip, { SegmentedTabs } from '@/components/ui/Chip'
import { Field, Input, OptionTile, Select, Toggle } from '@/components/ui/Field'
import Icon from '@/components/ui/Icon'
import { FEATURES, VEHICLE_TYPES } from '@/api/mock/spots'
import { useApp, DEFAULT_FILTERS } from '@/context/AppContext'

const PRICE_PRESETS_HOUR = [20, 30, 50, 100]
const PRICE_PRESETS_DAY = [150, 200, 300, 500]

const SORTS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'priceLow', label: 'Price: low to high' },
  { id: 'distance', label: 'Nearest first' },
  { id: 'rating', label: 'Top rated' },
]

/**
 * Full filter drawer (bottom sheet on mobile, side panel on desktop).
 * State lives in AppContext so the map list and the sheet never disagree.
 */
export default function FilterSheet({ open, onClose, resultCount = 0, zones = [], onSort, sort }) {
  const { filters, patchFilters, resetFilters } = useApp()
  const pricePresets = filters.plan === 'day' ? PRICE_PRESETS_DAY : PRICE_PRESETS_HOUR

  const toggleFeature = (id) =>
    patchFilters({
      features: filters.features.includes(id)
        ? filters.features.filter((f) => f !== id)
        : [...filters.features, id],
    })

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      subtitle={`${resultCount} ${resultCount === 1 ? 'spot' : 'spots'} match`}
      side="right"
      height="full"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={resetFilters} className="shrink-0">
            Clear all
          </Button>
          <Button full size="lg" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? 'spot' : 'spots'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6 pt-1">
        <Group title="Search area">
          <Select
            value={filters.zone}
            onChange={(event) => patchFilters({ zone: event.target.value })}
          >
            <option value="all">All mela zones</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </Select>
          <div className="relative mt-2">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <Input
              value={filters.q}
              onChange={(event) => patchFilters({ q: event.target.value })}
              placeholder="Ghat name, landmark or address"
              className="pl-9"
            />
          </div>
        </Group>

        <Group title="Vehicle">
          <div className="grid grid-cols-3 gap-2">
            {VEHICLE_TYPES.map((type) => (
              <OptionTile
                key={type.id}
                active={filters.vehicle === type.id}
                onClick={() =>
                  patchFilters({ vehicle: filters.vehicle === type.id ? 'all' : type.id })
                }
                icon={<Icon name={type.icon} size={17} />}
                title={type.short}
              />
            ))}
          </div>
        </Group>

        <Group title="Price">
          <SegmentedTabs
            tabs={[
              { id: 'hour', label: 'Hourly' },
              { id: 'day', label: 'Full day' },
            ]}
            value={filters.plan}
            onChange={(plan) => patchFilters({ plan, maxPrice: null })}
            className="mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {pricePresets.map((value) => (
              <Chip
                key={value}
                active={filters.maxPrice === value}
                onClick={() => patchFilters({ maxPrice: filters.maxPrice === value ? null : value })}
              >
                Up to ₹{value}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Must have">
          <div className="flex flex-wrap gap-2">
            {FEATURES.map((feature) => (
              <Chip
                key={feature.id}
                active={filters.features.includes(feature.id)}
                icon={<Icon name={feature.id === 'covered' ? 'home' : feature.id} size={14} />}
                onClick={() => toggleFeature(feature.id)}
              >
                {feature.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Booking">
          <div className="space-y-3">
            <Toggle
              checked={filters.onlyAvailable}
              onChange={(onlyAvailable) => patchFilters({ onlyAvailable })}
              label="Hide full spots"
              description="Only show listings with a free bay right now"
            />
            <Toggle
              checked={filters.instant}
              onChange={(instant) => patchFilters({ instant })}
              label="Instant book only"
              description="Skip listings that need host approval"
            />
            <Toggle
              checked={filters.openNow}
              onChange={(openNow) => patchFilters({ openNow })}
              label={`Open at this hour (${new Date().getHours()}:00)`}
              description="Filters out spots whose gate time has passed"
            />
          </div>
        </Group>

        <Group title="Sort by">
          <Select value={sort} onChange={(event) => onSort(event.target.value)}>
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Group>
      </div>
    </Sheet>
  )
}

function Group({ title, children }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-semibold text-muted">{title}</h3>
      {children}
    </section>
  )
}

export { DEFAULT_FILTERS, SORTS }
