import { db, auth } from '../firebase';
import { doc, updateDoc, increment, getDoc, setDoc } from 'firebase/firestore';

export type TrainingMode = 'recite' | 'blanks' | 'order';

export const ScoreService = {
  /**
   * حساب النقاط بناءً على عدد الكلمات والوضع
   * 1 نقطة لكل كلمة كقاعدة أساسية
   * التسميع (صوت/كتابة): 60% من النقاط
   * الفراغات: 20% من النقاط
   * الترتيب: 20% من النقاط
   */
  calculatePoints: (text: string, mode: TrainingMode): number => {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    let multiplier = 0;
    switch (mode) {
      case 'recite':
        multiplier = 0.6;
        break;
      case 'blanks':
        multiplier = 0.2;
        break;
      case 'order':
        multiplier = 0.2;
        break;
    }
    
    // تقريب النقاط لأقرب رقم صحيح
    return Math.max(1, Math.round(wordCount * multiplier));
  },

  /**
   * تحديث نقاط المستخدم في قاعدة البيانات
   */
  addPoints: async (points: number) => {
    if (!auth.currentUser) return;
    
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, {
        xp: increment(points),
        totalScore: increment(points),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error updating score:", error);
    }
  }
};
