import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Theme definitions based on the LBL component categories from dmak-soma
export const THEME_CATEGORIES = [
  { id: 'safety', name: 'Safety', description: 'Dosage, side effects, contraindications' },
  { id: 'efficacy', name: 'Efficacy', description: 'Clinical outcomes and effectiveness' },
  { id: 'brand', name: 'Brand', description: 'Brand identity and messaging' },
  { id: 'mechanism', name: 'Mechanism of Action', description: 'How the drug works' },
  { id: 'patient', name: 'Patient Focus', description: 'Patient benefits and quality of life' },
];

export interface ThemeData {
  id: string;
  name: string;
  description: string;
  components?: ComponentData[];
}

export interface ComponentData {
  id: string;
  name: string;
  content: string;
  section: string;
}

// Fetch theme-related components from the database
export async function fetchThemeComponents(themeId: string): Promise<ComponentData[]> {
  // Map theme to section in the database
  const sectionMap: Record<string, string> = {
    'safety': 'Safety',
    'efficacy': 'Evidence',
    'brand': 'Brand',
    'mechanism': 'Solution',
    'patient': 'Insight',
  };

  const section = sectionMap[themeId] || 'Safety';

  try {
    // Fetch from component_config table (correct table name)
    const { data, error } = await supabase
      .from('component_config')
      .select('id, name, description, section')
      .eq('section', section);

    if (error) {
      console.log('Using fallback theme data:', error.message);
      return getFallbackComponents(themeId);
    }

    if (data && data.length > 0) {
      console.log(`Retrieved ${data.length} components from component_config table`);
      return data.map((item: { id: string; name: string; description: string; section: string }) => ({
        id: item.id,
        name: item.name,
        content: item.description || '',
        section: item.section || section,
      }));
    }

    return getFallbackComponents(themeId);
  } catch {
    console.log('Database not available, using fallback');
    return getFallbackComponents(themeId);
  }
}

// Fallback data when database is not available
function getFallbackComponents(themeId: string): ComponentData[] {
  const fallbackData: Record<string, ComponentData[]> = {
    'safety': [
      { id: 'SAFE_01', name: 'Dosage Information', content: 'Recommended dosage and administration guidelines', section: 'Safety' },
      { id: 'SAFE_02', name: 'Strength/Form', content: 'Available strengths and formulations', section: 'Safety' },
      { id: 'SAFE_03', name: 'Safety Claims', content: 'Key safety profile and tolerability data', section: 'Safety' },
      { id: 'SAFE_04', name: 'Side Effects', content: 'Common and rare adverse reactions', section: 'Safety' },
      { id: 'SAFE_05', name: 'Contraindications', content: 'When not to use this medication', section: 'Safety' },
    ],
    'efficacy': [
      { id: 'EVID_01', name: 'Efficacy Claim', content: 'Primary efficacy endpoints and outcomes', section: 'Evidence' },
      { id: 'EVID_02', name: 'Chart Data', content: 'Clinical trial results visualization', section: 'Evidence' },
      { id: 'EVID_03', name: 'Study Summary', content: 'Key clinical study highlights', section: 'Evidence' },
    ],
    'brand': [
      { id: 'INIT_01a', name: 'Brand Root Name', content: 'Primary brand identifier', section: 'Brand' },
      { id: 'INIT_03', name: 'Main Headline', content: 'Primary marketing message', section: 'Brand' },
      { id: 'INIT_06', name: 'Tagline', content: 'Brand positioning statement', section: 'Brand' },
    ],
    'mechanism': [
      { id: 'SOL_01', name: 'USP/Claims', content: 'Unique selling proposition', section: 'Solution' },
      { id: 'SOL_03', name: 'MOA Diagram', content: 'Mechanism of action visualization', section: 'Solution' },
    ],
    'patient': [
      { id: 'INS_01', name: 'Target Patient', content: 'Ideal patient profile', section: 'Insight' },
      { id: 'INS_02', name: 'Disease Update', content: 'Current disease landscape', section: 'Insight' },
    ],
  };

  return fallbackData[themeId] || fallbackData['safety'];
}
