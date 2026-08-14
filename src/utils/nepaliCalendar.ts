// Nepali Calendar Utility Functions
import calendar2023 from '@/data/nepali-calendar/2023.json';
import calendar2024 from '@/data/nepali-calendar/2024.json';
import calendar2025 from '@/data/nepali-calendar/2025.json';
import calendar2026 from '@/data/nepali-calendar/2026.json';
import calendar2027 from '@/data/nepali-calendar/2027.json';
import calendar2028 from '@/data/nepali-calendar/2028.json';
import calendar2029 from '@/data/nepali-calendar/2029.json';
import calendar2030 from '@/data/nepali-calendar/2030.json';

export interface NepaliDay {
  np: string;
  en: string;
  tithi: string;
  event: string;
  day: string;
  specialday: boolean;
  holiday: boolean;
}

export interface NepaliMonth {
  [key: string]: NepaliDay[];
}

const calendarData: Record<number, NepaliMonth> = {
  2023: calendar2023 as NepaliMonth,
  2024: calendar2024 as NepaliMonth,
  2025: calendar2025 as NepaliMonth,
  2026: calendar2026 as NepaliMonth,
  2027: calendar2027 as NepaliMonth,
  2028: calendar2028 as NepaliMonth,
  2029: calendar2029 as NepaliMonth,
  2030: calendar2030 as NepaliMonth,
};

export const nepaliMonthNames = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const nepaliMonthNamesNepali = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

export const nepaliWeekDaysShort = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'];

// Map English month names to Nepali
const monthNameMap: Record<string, string> = {
  'Baishakh': 'Baishakh',
  'Jestha': 'Jestha', 
  'Ashadh': 'Ashadh',
  'Shrawan': 'Shrawan',
  'Bhadra': 'Bhadra',
  'Ashwin': 'Ashwin',
  'Kartik': 'Kartik',
  'Mangsir': 'Mangsir',
  'Poush': 'Poush',
  'Magh': 'Magh',
  'Falgun': 'Falgun',
  'Chaitra': 'Chaitra'
};

/**
 * Get Nepali month data for a given BS year and month
 */
export function getNepaliMonth(bsYear: number, monthName: string): NepaliDay[] {
  const yearData = calendarData[bsYear];
  if (!yearData) return [];

  const normalizedMonthName = monthNameMap[monthName] || monthName;
  return yearData[normalizedMonthName] || [];
}

/**
 * Get all holidays and events for a BS month
 */
export function getMonthEvents(bsYear: number, monthName: string): Array<{date: string; event: string; isHoliday: boolean; isSpecial: boolean}> {
  const monthData = getNepaliMonth(bsYear, monthName);
  return monthData
    .filter(day => day.event && day.event.trim() !== '')
    .map(day => ({
      date: day.np,
      event: day.event.trim(),
      isHoliday: day.holiday,
      isSpecial: day.specialday
    }));
}

/**
 * Simple BS year calculator from AD date
 * Note: This is approximate, for accurate conversion use proper library
 */
export function getApproximateBSYear(adDate: Date): number {
  const adYear = adDate.getFullYear();
  const adMonth = adDate.getMonth() + 1;
  
  // Before April, BS year is AD year + 56, after April it's AD year + 57
  if (adMonth < 4) {
    return adYear + 56;
  } else {
    return adYear + 57;
  }
}

/**
 * Get approximate BS month index from AD date
 */
export function getApproximateBSMonth(adDate: Date): number {
  const adMonth = adDate.getMonth(); // 0-11
  // Rough mapping: BS year starts around April
  // 0(Jan)-3(Apr) maps to months 9-12 of previous BS year
  // 4(May)-11(Dec) maps to months 1-8 of current BS year
  
  if (adMonth < 3) {
    return adMonth + 9; // Jan->9, Feb->10, Mar->11
  } else {
    return adMonth - 3; // Apr->0, May->1, ..., Dec->8
  }
}

/**
 * Convert Nepali numerals to English
 */
export function nepaliToEnglishNumber(nepaliNum: string): number {
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let result = nepaliNum;
  nepaliDigits.forEach((nepali, index) => {
    result = result.replace(new RegExp(nepali, 'g'), englishDigits[index]);
  });
  
  return parseInt(result) || 0;
}

/**
 * Convert English numerals to Nepali
 */
export function englishToNepaliNumber(englishNum: number): string {
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return englishNum.toString().split('').map(d => nepaliDigits[parseInt(d)] || d).join('');
}
