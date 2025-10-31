import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, Info, CheckCircle, Upload, FileText, X, Save, AlertCircle, BarChart3, Download, FileDown } from 'lucide-react';

const SUPABASE_URL = 'https://awwqfiyznpvvqduajnms.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3d3FmaXl6bnB2dnFkdWFqbm1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMzg5NjksImV4cCI6MjA3NjYxNDk2OX0.2riAnCc2Hs_PBbx8xAilcqVbSizsC_hMqmt9kcQXGig';

const supabase = {
  from: (table) => ({
    select: (columns = '*') => ({
      eq: (column, value) => ({
        order: (col, opts) => ({
          limit: (num) => ({
            then: async (resolve) => {
              const response = await fetch(
                `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}&order=${col}.${opts.ascending ? 'asc' : 'desc'}&limit=${num}`,
                {
                  headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                  }
                }
              );
              const data = await response.json();
              resolve({ data, error: null });
            }
          })
        })
      })
    }),
    insert: (record) => ({
      select: () => ({
        then: async (resolve) => {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(record)
          });
          const data = await response.json();
          resolve({ data, error: null });
        }
      })
    }),
    update: (record) => ({
      eq: (column, value) => ({
        then: async (resolve) => {
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}`,
            {
              method: 'PATCH',
              headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(record)
            }
          );
          const data = await response.json();
          resolve({ data, error: null });
        }
      })
    })
  })
};

const PrevGoQuestionnaire = () => {

const [currentSection, setCurrentSection] = useState('profil_base');
const [responses, setResponses] = useState({});
const [uploadedFiles, setUploadedFiles] = useState({});
const [anonymousId] = useState(() => 'PG' + Math.random().toString(36).substr(2, 9));
const navigationRef = useRef(null);

const [questionnaireId, setQuestionnaireId] = useState(null);
const [isSaving, setIsSaving] = useState(false);
const [lastSaved, setLastSaved] = useState(null);
const [saveError, setSaveError] = useState(null);
const [showDashboard, setShowDashboard] = useState(false);

/**
 * Sauvegarde automatique vers Supabase
 */
const saveToSupabase = async () => {
  if (Object.keys(responses).length === 0) return;
  
  setIsSaving(true);
  setSaveError(null);
  
  try {
    const dataToSave = {
      user_id: anonymousId,
      responses: responses,
      uploaded_files: uploadedFiles,
      current_section: currentSection,
      progress: calculateProgress(),
      status: 'en_cours',
      updated_at: new Date().toISOString()
    };

    if (questionnaireId) {
      // UPDATE
      await supabase
        .from('questionnaires')
        .update(dataToSave)
        .eq('id', questionnaireId);
    } else {
      // INSERT
      const { data } = await supabase
        .from('questionnaires')
        .insert(dataToSave)
        .select();
      
      if (data && data[0]) {
        setQuestionnaireId(data[0].id);
      }
    }
    
    setLastSaved(new Date());
    console.log('✅ Sauvegarde automatique réussie');
  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error);
    setSaveError('Erreur lors de la sauvegarde');
  } finally {
    setIsSaving(false);
  }
};

/**
 * Chargement depuis Supabase au démarrage
 */
const loadFromSupabase = async () => {
  try {
    const { data, error } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('user_id', anonymousId)
      .eq('status', 'en_cours')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      const saved = data[0];
      setQuestionnaireId(saved.id);
      setResponses(saved.responses || {});
      setUploadedFiles(saved.uploaded_files || {});
      setCurrentSection(saved.current_section || 'profil_base');
      setLastSaved(new Date(saved.updated_at));
      
      // Proposer de reprendre
      if (Object.keys(saved.responses).length > 0) {
        setShowDashboard(true);
      }
    }
  } catch (error) {
    console.error('Erreur chargement:', error);
  }
};

/**
 * Auto-save toutes les 30 secondes
 */
useEffect(() => {
  const saveInterval = setInterval(() => {
    saveToSupabase();
  }, 30000); // 30 secondes

  return () => clearInterval(saveInterval);
}, [responses, uploadedFiles, currentSection]);

/**
 * Sauvegarder à chaque changement de réponse
 */
useEffect(() => {
  if (Object.keys(responses).length > 0) {
    const debounceTimer = setTimeout(() => {
      saveToSupabase();
    }, 2000); // 2 secondes après le dernier changement

    return () => clearTimeout(debounceTimer);
  }
}, [responses]);

/**
 * Charger au démarrage du composant
 */
useEffect(() => {
  loadFromSupabase();
}, []);

const navigateToSection = (sectionKey) => {
  setCurrentSection(sectionKey);
  if (navigationRef.current) {
    navigationRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const nextSection = () => {
  const visibleSections = Object.keys(questionnaireSections);
  const currentIndex = visibleSections.indexOf(currentSection);
  if (currentIndex < visibleSections.length - 1) {
    navigateToSection(visibleSections[currentIndex + 1]);
  }
};

const prevSection = () => {
  const visibleSections = Object.keys(questionnaireSections);
  const currentIndex = visibleSections.indexOf(currentSection);
  if (currentIndex > 0) {
    navigateToSection(visibleSections[currentIndex - 1]);
  }
};

/**
 * Permet l'upload itératif de plusieurs fichiers pour une même question
 */
const handleIterativeUpload = (questionId, file) => {
  if (!file) return;
  
  const newUpload = {
    file: file,
    timestamp: new Date().toISOString(),
    status: 'ready'
  };

  setUploadedFiles(prev => ({
    ...prev,
    [questionId]: [...(prev[questionId] || []), newUpload]
  }));
};

/**
 * Gestion du tableau ASSIST (substances)
 */
const handleAssistTableChange = (substanceId, column, checked) => {
  setResponses(prev => {
    const currentTable = prev.assist_table || {};
    const substanceData = currentTable[substanceId] || { vie: false, trois_mois: false };
    return {
      ...prev,
      assist_table: {
        ...currentTable,
        [substanceId]: {
          ...substanceData,
          [column]: checked
        }
      }
    };
  });
};

/**
 * Détermine si une question doit être affichée selon les réponses précédentes
 */
const shouldShowQuestion = (questionId) => {
  const familyCancerTypes = responses.family_cancer_types || [];
  const assistData = responses.assist_table || {};
  const hasSubstanceVie = (substance) => assistData[substance]?.vie === true;
  const hasSubstance3mois = (substance) => assistData[substance]?.trois_mois === true;
  
  // Calcul de l'âge
  const age = responses.age ? parseInt(responses.age) : 0;
  const sexe = responses.sexe;
  
  // Antécédents
  const antecedentsPerso = responses.antecedents_perso || [];
  const hasHysterectomyTotal = responses.hysterectomy_type === 'totale';
  
  // Profession
  const profession = responses.profession;

  switch (questionId) {
    // ========== RADIOTHÉRAPIE ==========
    case 'radiotherapy_zones':
      return responses.radiotherapy_history === 'yes';
    
    // ========== CANCERS FAMILIAUX : CRITÈRES ==========
    case 'family_cancer_breast_criteria':
      return familyCancerTypes.includes('breast');
    case 'family_cancer_ovary_criteria':
      return familyCancerTypes.includes('ovary');
    case 'family_cancer_prostate_criteria':
      return familyCancerTypes.includes('prostate');
    case 'family_cancer_colorectal_criteria':
      return familyCancerTypes.includes('colorectal');
    case 'family_cancer_skin_criteria':
      return familyCancerTypes.includes('skin');
    case 'family_cancer_pancreas_criteria':
      return familyCancerTypes.includes('pancreas');
    
    // ========== CANCERS FAMILIAUX : DÉTAILS ==========
    case 'family_cancer_breast_details':
      return responses.family_cancer_breast_criteria === 'yes';
    case 'family_cancer_ovary_details':
      return responses.family_cancer_ovary_criteria === 'yes';
    case 'family_cancer_prostate_details':
      return responses.family_cancer_prostate_criteria === 'yes';
    case 'family_cancer_colorectal_details':
      return responses.family_cancer_colorectal_criteria === 'yes';
    case 'family_cancer_skin_details':
      return responses.family_cancer_skin_criteria === 'yes';
    case 'family_cancer_pancreas_details':
      return responses.family_cancer_pancreas_criteria === 'yes';
    
    // ========== BLOC GÉNÉTIQUE ==========
    case 'genetic_research_question':
      return (
        responses.family_cancer_breast_criteria === 'yes' ||
        responses.family_cancer_ovary_criteria === 'yes' ||
        responses.family_cancer_prostate_criteria === 'yes' ||
        responses.family_cancer_colorectal_criteria === 'yes' ||
        responses.family_cancer_skin_criteria === 'yes' ||
        responses.family_cancer_pancreas_criteria === 'yes'
      );
    
    case 'genetic_markers_tested':
      return responses.genetic_research_family === 'yes';
    
    case 'genetic_results_upload':
      return responses.genetic_research_family === 'yes' && 
             responses.genetic_markers_tested && 
             responses.genetic_markers_tested.length > 0;
    
    // ========== ATCDP : MÉNOPAUSE (FEMMES) ==========
    case 'menopause_status':
      return sexe === 'femme';
    case 'menopause_age':
      return sexe === 'femme' && responses.menopause_status === 'oui';
    case 'menopause_type':
      return sexe === 'femme' && responses.menopause_status === 'oui';
    case 'hormone_therapy':
      return sexe === 'femme' && responses.menopause_status === 'oui';
    
    // ========== ATCDP : CHIRURGIES DU SEIN ==========
    case 'breast_surgery_detail':
      return antecedentsPerso.includes('chirurgie_sein');
    
    // ========== ATCDP : HYSTÉRECTOMIE ==========
    case 'hysterectomy_type':
      return antecedentsPerso.includes('hysterectomie');
    
    // ========== ATCDP : SUIVI DES ANTÉCÉDENTS ==========
    case 'antecedents_followup':
      const hasTrackedAntecedents = antecedentsPerso.some(atcd => 
        ['has_diabete', 'has_hta', 'has_dyslipid', 'has_asthme', 'has_bpco', 
         'has_hypothyroid', 'has_hyperthyroid', 'has_depression', 'has_cancer'].includes(atcd)
      );
      return hasTrackedAntecedents;
    
    // ========== FDRM : TABAC ==========
    case 'has_tabac_vie':
      return hasSubstanceVie('tabac');
    case 'is_tabac_actuel':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac');
    case 'tabac_cigarettes_jour':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    case 'tabac_duree_annees':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    case 'tabac_type':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    case 'tabac_envie_arreter':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    case 'tabac_tentatives_arret':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    
    case 'tabac_ancien_cigarettes_jour':
      return hasSubstanceVie('tabac') && responses.is_tabac_actuel === 'non';
    case 'tabac_ancien_duree_annees':
      return hasSubstanceVie('tabac') && responses.is_tabac_actuel === 'non';
    case 'tabac_ancien_arret_date':
      return hasSubstanceVie('tabac') && responses.is_tabac_actuel === 'non';
    
    case 'fagerström_q1':
    case 'fagerström_q2':
    case 'fagerström_q3':
    case 'fagerström_q4':
    case 'fagerström_q5':
    case 'fagerström_q6':
      return hasSubstanceVie('tabac') && hasSubstance3mois('tabac') && responses.is_tabac_actuel === 'oui';
    
    // ========== FDRM : ALCOOL ==========
    case 'audit_q1':
    case 'audit_q2':
    case 'audit_q3':
    case 'audit_q4':
    case 'audit_q5':
    case 'audit_q6':
    case 'audit_q7':
    case 'audit_q8':
    case 'audit_q9':
    case 'audit_q10':
      return hasSubstanceVie('alcool') && hasSubstance3mois('alcool');
    
    // ========== FDRM : CANNABIS ==========
    case 'cast_q1':
    case 'cast_q2':
    case 'cast_q3':
    case 'cast_q4':
    case 'cast_q5':
    case 'cast_q6':
      return hasSubstanceVie('cannabis') && hasSubstance3mois('cannabis');
    
    // ========== VACCINATION : HPV ==========
    case 'vaccine_hpv':
      return age >= 11 && age <= 26;
    case 'vaccine_hpv_doses':
      return age >= 11 && age <= 26 && responses.vaccine_hpv === 'oui';
    case 'vaccine_hpv_last_dose':
      return age >= 11 && age <= 26 && responses.vaccine_hpv === 'oui';
    
    // ========== VACCINATION : ZONA ==========
    case 'vaccine_zona':
      return age >= 65;
    case 'vaccine_zona_doses':
      return age >= 65 && responses.vaccine_zona === 'oui';
    
    // ========== VACCINATION : PROFESSIONNELS DE SANTÉ ==========
    case 'vaccine_hepatite_b_pro':
    case 'vaccine_coqueluche_pro':
    case 'vaccine_varicelle_pro':
      return profession === 'sante';
    
    // ========== VACCINATION : VOYAGES ==========
    case 'vaccine_fievre_jaune':
    case 'vaccine_encephalite_japonaise':
    case 'vaccine_rage':
      return responses.voyages_internationaux === 'oui';
    
    // ========== DÉPISTAGES : SEIN ==========
    case 'depistage_sein_mammo_date':
      return sexe === 'femme' && age >= 40;
    case 'depistage_sein_echo_date':
      return sexe === 'femme' && age >= 40;
    case 'depistage_sein_irm_date':
      return sexe === 'femme' && age >= 40 && (
        responses.family_cancer_breast_criteria === 'yes' ||
        antecedentsPerso.includes('cancer_sein')
      );
    
    // ========== DÉPISTAGES : COL UTÉRUS (EXCLUSION HYSTÉRECTOMIE TOTALE) ==========
    case 'depistage_col_frottis_date':
    case 'depistage_col_hpv_date':
      return sexe === 'femme' && age >= 25 && age <= 65 && !hasHysterectomyTotal;
    
    // ========== DÉPISTAGES : PROSTATE ==========
    case 'depistage_prostate_psa_date':
    case 'depistage_prostate_tr_date':
      return sexe === 'homme' && age >= 45;
    
    // ========== DÉPISTAGES : COLORECTAL ==========
    case 'depistage_colorectal_test_date':
    case 'depistage_colorectal_coloscopie_date':
      return age >= 50 && age <= 74;
    
    // ========== DÉPISTAGES : POUMON (FUMEURS) ==========
    case 'depistage_poumon_scanner_date':
      return hasSubstanceVie('tabac') && age >= 50 && age <= 74;
    
    // ========== DÉPISTAGES : PEAU (MÉLANOME FAMILIAL) ==========
    case 'depistage_peau_dermato_date':
      return responses.family_cancer_skin_criteria === 'yes';
    
    default:
      return true;
  }
};

const getGeneticMarkersOptions = () => {
  const markers = [];
  
  const atRisk = {
    breast: responses.family_cancer_breast_criteria === 'yes',
    ovary: responses.family_cancer_ovary_criteria === 'yes',
    prostate: responses.family_cancer_prostate_criteria === 'yes',
    colorectal: responses.family_cancer_colorectal_criteria === 'yes',
    skin: responses.family_cancer_skin_criteria === 'yes',
    pancreas: responses.family_cancer_pancreas_criteria === 'yes'
  };

  const buildLabel = (markerName, cancerTypes) => {
    const relevantCancers = cancerTypes
      .filter(cancer => atRisk[cancer])
      .map(cancer => {
        switch(cancer) {
          case 'breast': return 'sein';
          case 'ovary': return 'ovaire';
          case 'prostate': return 'prostate';
          case 'colorectal': return 'colorectal';
          case 'skin': return 'mélanome';
          case 'pancreas': return 'pancréas';
          default: return cancer;
        }
      });
    
    if (relevantCancers.length === 0) return null;
    return `${markerName} (cancer du ${relevantCancers.join('/')})`;
  };

  if (atRisk.breast || atRisk.ovary) {
    const label = buildLabel('BRCA1', ['breast', 'ovary']);
    if (label) markers.push({ value: 'brca1', label });
  }

  if (atRisk.breast || atRisk.ovary || atRisk.prostate || atRisk.pancreas) {
    const label = buildLabel('BRCA2', ['breast', 'ovary', 'prostate', 'pancreas']);
    if (label) markers.push({ value: 'brca2', label });
  }

  if (atRisk.breast) {
    markers.push({ value: 'chek2', label: 'CHEK2 (cancer du sein)' });
  }

  if (atRisk.breast || atRisk.pancreas) {
    const label = buildLabel('PALB2', ['breast', 'pancreas']);
    if (label) markers.push({ value: 'palb2', label });
  }

  if (atRisk.breast || atRisk.ovary) {
    markers.push({ value: 'tp53', label: 'TP53 (syndrome de Li-Fraumeni - cancers sein/ovaire et autres)' });
  }

  if (atRisk.prostate) {
    markers.push({ value: 'hoxb13', label: 'HOXB13 (cancer de la prostate)' });
  }

  if (atRisk.colorectal) {
    markers.push({ 
      value: 'lynch', 
      label: 'Syndrome de Lynch : MLH1, MSH2, MSH6, PMS2 (cancer colorectal)' 
    });
  }

  if (atRisk.colorectal) {
    markers.push({ 
      value: 'apc', 
      label: 'APC (polypose adénomateuse familiale - cancer colorectal)' 
    });
  }

  if (atRisk.skin) {
    markers.push({ value: 'cdkn2a', label: 'CDKN2A (mélanome familial)' });
  }

  markers.push({ value: 'panel_complet', label: 'Panel complet multi-gènes (oncogénétique complète)' });
  markers.push({ value: 'autre', label: 'Autre marqueur génétique' });
  markers.push({ value: 'unknown_marker', label: 'Ne connaît pas le nom du marqueur testé' });

  return markers;
};

const getCurrentQuestions = () => {
  const section = questionnaireSections[currentSection];
  if (!section) return [];
  
  return section.questions.filter(question => {
    if (!question.condition) return true;
    return shouldShowQuestion(question.condition);
  });
};

const getOptionLabel = (systemType, system, value) => {
  const questionId = systemType === 'medical' 
    ? `antecedents_medical_${system}`
    : `antecedents_surgical_${system}`;
  
  const question = questionnaireSections.antecedents_perso.questions.find(q => q.id === questionId);
  if (!question) return value;
  
  const option = question.options?.find(opt => opt.value === value);
  return option ? option.label : value;
};

const buildFollowupList = () => {
  const followupItems = [];
  const trackedConditions = {
    has_diabete: 'Diabète',
    has_hta: 'Hypertension artérielle',
    has_dyslipid: 'Dyslipidémie',
    has_asthme: 'Asthme',
    has_bpco: 'BPCO',
    has_hypothyroid: 'Hypothyroïdie',
    has_hyperthyroid: 'Hyperthyroïdie',
    has_depression: 'Dépression/Troubles anxieux',
    has_cancer: 'Cancer personnel'
  };

  const antecedentsPerso = responses.antecedents_perso || [];
  
  Object.entries(trackedConditions).forEach(([key, label]) => {
    if (antecedentsPerso.includes(key)) {
      followupItems.push({ id: key, label });
    }
  });

  return followupItems;
};

const handleResponse = (questionId, value) => {
  setResponses(prev => {
    const newResponses = { ...prev, [questionId]: value };
    
    if (questionId === 'family_cancer_types') {
      const hasNone = value.includes('none');
      const hasOthers = value.filter(v => v !== 'none').length > 0;
      
      if (hasNone && hasOthers) {
        newResponses[questionId] = value.filter(v => v !== 'none');
      } else if (hasNone && !hasOthers) {
        newResponses[questionId] = ['none'];
      }
    }
    
    if (questionId === 'family_cvdm_types') {
      const hasNone = value.includes('no');
      const hasOthers = value.filter(v => v !== 'no').length > 0;
      
      if (hasNone && hasOthers) {
        newResponses[questionId] = value.filter(v => v !== 'no');
      } else if (hasNone && !hasOthers) {
        newResponses[questionId] = ['no'];
      }
    }
    
    if (questionId === 'family_cardiovascular') {
      const hasNone = value.includes('none');
      const hasOthers = value.filter(v => v !== 'none').length > 0;
      
      if (hasNone && hasOthers) {
        newResponses[questionId] = value.filter(v => v !== 'none');
      } else if (hasNone && !hasOthers) {
        newResponses[questionId] = ['none'];
      }
    }
    
    return newResponses;
  });
};

/**
 * CORRECTION MAJEURE V31
 * Calcule le statut d'une section en comptant TOUTES les questions visibles
 */
const calculateSectionStatus = (sectionKey) => {
  const section = questionnaireSections[sectionKey];
  if (!section) return 'empty';
  
  // Filtrer les questions visibles (exclure type "info")
  const visibleQuestions = section.questions.filter(question => {
    if (question.type === 'info') return false;
    if (!question.condition) return true;
    return shouldShowQuestion(question.condition);
  });

  // Compter TOUTES les questions visibles (required ET optionnelles)
  const allVisibleQuestions = visibleQuestions;

  const answeredQuestions = allVisibleQuestions.filter(q => {
    const answer = responses[q.id];
    
    // Validation robuste
    if (answer === undefined || answer === null || answer === '') return false;
    if (Array.isArray(answer)) return answer.length > 0;
    if (typeof answer === 'object') return Object.keys(answer).length > 0;
    
    return true;
  }).length;

  if (allVisibleQuestions.length === 0) return 'empty';
  
  // ✅ Section "complete" UNIQUEMENT si TOUTES les questions visibles sont répondues
  if (answeredQuestions === allVisibleQuestions.length) return 'complete';
  if (answeredQuestions > 0) return 'partial';
  return 'empty';
};

const getSectionStatusColor = (sectionKey) => {
  const status = calculateSectionStatus(sectionKey);
  switch (status) {
    case 'complete': return 'bg-green-100 text-green-800 border-green-300';
    case 'partial': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'empty': return 'bg-red-100 text-red-800 border-red-300';
    default: return 'bg-gray-100 text-gray-600 border-gray-300';
  }
};

/**
 * CORRECTION V31
 * Calcule la progression globale (0-100%)
 */
const calculateProgress = () => {
  const visibleSections = Object.keys(questionnaireSections);
  const totalSections = visibleSections.length;
  const completedSections = visibleSections.filter(key => 
    calculateSectionStatus(key) === 'complete'
  ).length;
  
  return Math.round((completedSections / totalSections) * 100);
};

const questionnaireSections = {
  
  // ==========================================================================
  // SECTION 6.1 : PROFIL DE BASE (~15 questions)
  // ==========================================================================
  profil_base: {
    title: "Profil de Base",
    icon: "👤",
    questions: [
      {
        id: 'age',
        text: 'Quel est votre âge ?',
        type: 'number',
        required: true,
        min: 0,
        max: 120,
        helpText: 'Votre âge permettra d\'adapter les questions et recommandations'
      },
      {
        id: 'sexe',
        text: 'Quel est votre sexe biologique ?',
        type: 'radio',
        required: true,
        options: [
          { value: 'homme', label: 'Homme' },
          { value: 'femme', label: 'Femme' }
        ]
      },
      {
        id: 'genre',
        text: 'Quel est votre genre ?',
        type: 'radio',
        required: true,
        options: [
          { value: 'homme', label: 'Homme' },
          { value: 'femme', label: 'Femme' },
          { value: 'homme_trans', label: 'Homme transgenre (FTM)' },
          { value: 'femme_trans', label: 'Femme transgenre (MTF)' },
          { value: 'autre', label: 'Autre' }
        ]
      },
      {
        id: 'ancestry',
        text: 'Quelle est l\'ascendance géographique de votre mère/père ?',
        type: 'ancestry_table',
        required: true,
        helpText: 'Utile pour évaluer certains facteurs génétiques ou risques de santé'
      },
      {
        id: 'profession',
        text: 'Quelle est votre profession ?',
        type: 'text',
        required: true,
        helpText: 'Indiquez votre profession actuelle ou votre dernier emploi si vous êtes retraité(e)'
      },
      {
        id: 'profession_secteur',
        text: 'Votre profession est-elle dans l\'un de ces secteurs à risque ?',
        type: 'checkbox',
        required: false,
        helpText: 'Sélectionnez si applicable (pour les recommandations vaccinales)',
        options: [
          { value: 'sante', label: 'Santé (médecin, infirmier, aide-soignant, etc.)' },
          { value: 'enseignant', label: 'Enseignement' },
          { value: 'petite_enfance', label: 'Petite enfance / Crèche' },
          { value: 'veterinaire', label: 'Vétérinaire' },
          { value: 'aucun', label: 'Aucun de ces secteurs' }
        ]
      },
      {
        id: 'auto_mesures',
        text: 'Auto-mesures',
        type: 'auto_mesures_table',
        required: false,
        helpText: 'Remplissez les valeurs que vous connaissez (laisser vide si inconnu)'
      }
    ]
  },

  // ==========================================================================
  // SECTION 6.2 : ANTÉCÉDENTS PERSONNELS (~50 questions)
  // ==========================================================================
  personal_history: {
    title: "Antécédents Personnels",
    icon: "🏥",
    questions: [
      {
        id: 'atcdp_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '🏥 Cette section collecte vos antécédents médicaux et chirurgicaux pour adapter votre suivi préventif.'
      },
      
      // === BLOC GYNÉCOLOGIQUE (FEMMES) ===
      {
        id: 'menopause_status',
        text: 'Êtes-vous ménopausée ?',
        type: 'radio',
        condition: 'menopause_status',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' },
          { value: 'ne_sais_pas', label: 'Ne sais pas' }
        ]
      },
      {
        id: 'menopause_age',
        text: 'À quel âge avez-vous été ménopausée ?',
        type: 'number',
        condition: 'menopause_age',
        required: false,
        min: 30,
        max: 65
      },
      {
        id: 'menopause_type',
        text: 'Type de ménopause ?',
        type: 'radio',
        condition: 'menopause_type',
        required: false,
        options: [
          { value: 'naturelle', label: 'Naturelle' },
          { value: 'chirurgicale', label: 'Chirurgicale (ovariectomie)' },
          { value: 'chimio', label: 'Suite chimiothérapie/radiothérapie' }
        ]
      },
      {
        id: 'hormone_therapy',
        text: 'Avez-vous pris ou prenez-vous un traitement hormonal substitutif (THS) ?',
        type: 'radio',
        condition: 'hormone_therapy',
        required: false,
        options: [
          { value: 'non', label: 'Non, jamais' },
          { value: 'oui_actuel', label: 'Oui, actuellement' },
          { value: 'oui_passe', label: 'Oui, dans le passé' }
        ]
      },

      // === ANTÉCÉDENTS MÉDICAUX PAR SYSTÈMES ===
      {
        id: 'antecedents_medical_intro',
        text: 'Antécédents médicaux',
        type: 'info',
        content: '💊 Cochez tous les antécédents médicaux que vous avez ou avez eu.'
      },
      
      // Système Cardiovasculaire
      {
        id: 'antecedents_medical_cardio',
        text: 'Système Cardiovasculaire',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'has_hta', label: 'Hypertension artérielle' },
          { value: 'infarctus', label: 'Infarctus du myocarde' },
          { value: 'avc', label: 'AVC / AIT' },
          { value: 'insuffisance_cardiaque', label: 'Insuffisance cardiaque' },
          { value: 'arythmie', label: 'Arythmie cardiaque (FA, flutter, etc.)' },
          { value: 'arteriopathie', label: 'Artériopathie des membres inférieurs' },
          { value: 'aucun_cardio', label: 'Aucun antécédent cardiovasculaire' }
        ]
      },
      
      // Système Respiratoire
      {
        id: 'antecedents_medical_respi',
        text: 'Système Respiratoire',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'has_asthme', label: 'Asthme' },
          { value: 'has_bpco', label: 'BPCO (Bronchopneumopathie chronique obstructive)' },
          { value: 'emphyseme', label: 'Emphysème' },
          { value: 'apnee_sommeil', label: 'Syndrome d\'apnée du sommeil' },
          { value: 'tuberculose', label: 'Tuberculose' },
          { value: 'aucun_respi', label: 'Aucun antécédent respiratoire' }
        ]
      },
      
      // Système Endocrinien/Métabolique
      {
        id: 'antecedents_medical_endocrino',
        text: 'Système Endocrinien et Métabolique',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'has_diabete', label: 'Diabète (type 1 ou 2)' },
          { value: 'has_dyslipid', label: 'Dyslipidémie (cholestérol, triglycérides)' },
          { value: 'has_hypothyroid', label: 'Hypothyroïdie' },
          { value: 'has_hyperthyroid', label: 'Hyperthyroïdie' },
          { value: 'obesite', label: 'Obésité' },
          { value: 'goutte', label: 'Goutte' },
          { value: 'aucun_endocrino', label: 'Aucun antécédent endocrinien' }
        ]
      },
      
      // Système Digestif
      {
        id: 'antecedents_medical_digestif',
        text: 'Système Digestif',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'rgo', label: 'Reflux gastro-œsophagien (RGO)' },
          { value: 'ulcere', label: 'Ulcère gastrique ou duodénal' },
          { value: 'maladie_crohn', label: 'Maladie de Crohn' },
          { value: 'rch', label: 'Rectocolite hémorragique (RCH)' },
          { value: 'hepatite', label: 'Hépatite (B, C, ou autre)' },
          { value: 'cirrhose', label: 'Cirrhose hépatique' },
          { value: 'aucun_digestif', label: 'Aucun antécédent digestif' }
        ]
      },
      
      // Système Neurologique
      {
        id: 'antecedents_medical_neuro',
        text: 'Système Neurologique',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'epilepsie', label: 'Épilepsie' },
          { value: 'sep', label: 'Sclérose en plaques' },
          { value: 'parkinson', label: 'Maladie de Parkinson' },
          { value: 'alzheimer', label: 'Maladie d\'Alzheimer ou démence' },
          { value: 'migraine', label: 'Migraines chroniques' },
          { value: 'aucun_neuro', label: 'Aucun antécédent neurologique' }
        ]
      },
      
      // Système Ostéo-articulaire
      {
        id: 'antecedents_medical_osteo',
        text: 'Système Ostéo-articulaire',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'arthrose', label: 'Arthrose' },
          { value: 'polyarthrite', label: 'Polyarthrite rhumatoïde' },
          { value: 'osteoporose', label: 'Ostéoporose' },
          { value: 'spondylarthrite', label: 'Spondylarthrite' },
          { value: 'fibromyalgie', label: 'Fibromyalgie' },
          { value: 'aucun_osteo', label: 'Aucun antécédent ostéo-articulaire' }
        ]
      },
      
      // Système Urologique/Rénal
      {
        id: 'antecedents_medical_uro',
        text: 'Système Urologique et Rénal',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'insuffisance_renale', label: 'Insuffisance rénale chronique' },
          { value: 'calculs_renaux', label: 'Calculs rénaux' },
          { value: 'infection_urinaire_recidivante', label: 'Infections urinaires récidivantes' },
          { value: 'hypertrophie_prostate', label: 'Hypertrophie bénigne de la prostate' },
          { value: 'aucun_uro', label: 'Aucun antécédent urologique' }
        ]
      },
      
      // Système Hématologique
      {
        id: 'antecedents_medical_hemato',
        text: 'Système Hématologique',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'anemie', label: 'Anémie chronique' },
          { value: 'thrombose', label: 'Thrombose veineuse / Phlébite' },
          { value: 'embolie', label: 'Embolie pulmonaire' },
          { value: 'trouble_coagulation', label: 'Trouble de la coagulation' },
          { value: 'aucun_hemato', label: 'Aucun antécédent hématologique' }
        ]
      },
      
      // Système Dermatologique
      {
        id: 'antecedents_medical_dermato',
        text: 'Système Dermatologique',
        type: 'checkbox_with_other',
        required: false,
        options: [
          { value: 'psoriasis', label: 'Psoriasis' },
          { value: 'eczema', label: 'Eczéma chronique' },
          { value: 'lupus', label: 'Lupus érythémateux' },
          { value: 'aucun_dermato', label: 'Aucun antécédent dermatologique' }
        ]
      },

      // === ANTÉCÉDENTS CHIRURGICAUX ===
      {
        id: 'antecedents_surgical_intro',
        text: 'Antécédents chirurgicaux',
        type: 'info',
        content: '🏥 Cochez toutes les chirurgies que vous avez subies.'
      },
      
      // Chirurgie Cardiovasculaire
      {
        id: 'antecedents_surgical_cardio',
        text: 'Chirurgie Cardiovasculaire',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'pontage', label: 'Pontage coronarien' },
          { value: 'angioplastie', label: 'Angioplastie / Stent' },
          { value: 'valve', label: 'Chirurgie valvulaire cardiaque' },
          { value: 'pacemaker', label: 'Pose de pacemaker / Défibrillateur' },
          { value: 'aucun_chir_cardio', label: 'Aucune chirurgie cardiovasculaire' }
        ]
      },
      
      // Chirurgie Digestive
      {
        id: 'antecedents_surgical_digestif',
        text: 'Chirurgie Digestive',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'appendicectomie', label: 'Appendicectomie' },
          { value: 'cholecystectomie', label: 'Cholécystectomie (ablation vésicule biliaire)' },
          { value: 'hernie', label: 'Cure de hernie (inguinale, ombilicale, etc.)' },
          { value: 'sleeve', label: 'Sleeve gastrectomie (chirurgie bariatrique)' },
          { value: 'bypass', label: 'Bypass gastrique' },
          { value: 'colectomie', label: 'Colectomie (partielle ou totale)' },
          { value: 'aucun_chir_digestif', label: 'Aucune chirurgie digestive' }
        ]
      },
      
      // Chirurgie Orthopédique
      {
        id: 'antecedents_surgical_ortho',
        text: 'Chirurgie Orthopédique',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'prothese_hanche', label: 'Prothèse de hanche' },
          { value: 'prothese_genou', label: 'Prothèse de genou' },
          { value: 'chirurgie_epaule', label: 'Chirurgie de l\'épaule' },
          { value: 'chirurgie_rachis', label: 'Chirurgie du rachis (hernie discale, etc.)' },
          { value: 'aucun_chir_ortho', label: 'Aucune chirurgie orthopédique' }
        ]
      },
      
      // Chirurgie Gynécologique
      {
        id: 'antecedents_surgical_gyneco',
        text: 'Chirurgie Gynécologique',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'hysterectomie', label: 'Hystérectomie (ablation utérus)' },
          { value: 'ovariectomie', label: 'Ovariectomie (ablation ovaires)' },
          { value: 'chirurgie_sein', label: 'Chirurgie du sein (tumorectomie, mastectomie, réduction, augmentation)' },
          { value: 'cesarienne', label: 'Césarienne' },
          { value: 'conisation', label: 'Conisation du col utérin' },
          { value: 'aucun_chir_gyneco', label: 'Aucune chirurgie gynécologique' }
        ]
      },
      
      // Détails Hystérectomie
      {
        id: 'hysterectomy_type',
        text: 'Type d\'hystérectomie ?',
        type: 'radio',
        condition: 'hysterectomy_type',
        required: false,
        options: [
          { value: 'totale', label: 'Totale (avec ablation du col)' },
          { value: 'subtotale', label: 'Subtotale (col conservé)' }
        ]
      },
      
      // Détails Chirurgie Sein
      {
        id: 'breast_surgery_detail',
        text: 'Détails de la chirurgie du sein',
        type: 'breast_surgery_detail',
        condition: 'breast_surgery_detail',
        required: false
      },
      
      // Chirurgie Urologique
      {
        id: 'antecedents_surgical_uro',
        text: 'Chirurgie Urologique',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'prostatectomie', label: 'Prostatectomie' },
          { value: 'nephrectomie', label: 'Néphrectomie (ablation rein)' },
          { value: 'aucun_chir_uro', label: 'Aucune chirurgie urologique' }
        ]
      },
      
      // Chirurgie ORL
      {
        id: 'antecedents_surgical_orl',
        text: 'Chirurgie ORL',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'amygdales', label: 'Amygdalectomie' },
          { value: 'thyroidectomie', label: 'Thyroïdectomie' },
          { value: 'aucun_chir_orl', label: 'Aucune chirurgie ORL' }
        ]
      },
      
      // Chirurgie Ophtalmologique
      {
        id: 'antecedents_surgical_ophtalmo',
        text: 'Chirurgie Ophtalmologique',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'cataracte', label: 'Chirurgie de la cataracte' },
          { value: 'lasik', label: 'LASIK / Chirurgie réfractive' },
          { value: 'glaucome', label: 'Chirurgie du glaucome' },
          { value: 'aucun_chir_ophtalmo', label: 'Aucune chirurgie ophtalmologique' }
        ]
      },
      
      // Autres Chirurgies
      {
        id: 'antecedents_surgical_autres',
        text: 'Autres Chirurgies',
        type: 'checkbox',
        required: false,
        options: [
          { value: 'transplantation', label: 'Transplantation d\'organe' },
          { value: 'autre_chirurgie', label: 'Autre chirurgie importante' },
          { value: 'aucun_autre', label: 'Aucune autre chirurgie' }
        ]
      },

      // === RADIOTHÉRAPIE ===
      {
        id: 'radiotherapy_history',
        text: 'Avez-vous déjà reçu une radiothérapie ?',
        type: 'radio',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'yes', label: 'Oui' }
        ]
      },
      {
        id: 'radiotherapy_zones',
        text: 'Sur quelles zones corporelles ?',
        type: 'checkbox',
        condition: 'radiotherapy_zones',
        required: false,
        helpText: 'Sélectionnez toutes les zones ayant reçu de la radiothérapie',
        options: [
          { value: 'tete_cou', label: 'Tête et cou' },
          { value: 'thorax', label: 'Thorax/Poumons' },
          { value: 'sein', label: 'Sein' },
          { value: 'abdomen', label: 'Abdomen' },
          { value: 'pelvis', label: 'Pelvis' },
          { value: 'membres', label: 'Membres' },
          { value: 'autre', label: 'Autre zone' }
        ]
      },
      
      // === CHIMIOTHÉRAPIE ===
      {
        id: 'chimiotherapie_history',
        text: 'Avez-vous déjà reçu une chimiothérapie ?',
        type: 'radio',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      
      // === CANCER PERSONNEL ===
      {
        id: 'cancer_personnel',
        text: 'Avez-vous déjà eu un cancer ?',
        type: 'radio',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },

      // === TABLEAU DE SUIVI DES ANTÉCÉDENTS ===
      {
        id: 'antecedents_followup',
        text: 'Suivi de vos antécédents',
        type: 'antecedents_followup_table',
        condition: 'antecedents_followup',
        required: false,
        helpText: 'Indiquez le statut du suivi médical pour chaque antécédent déclaré'
      }
    ]
  },

  // ==========================================================================
  // SECTION 6.3 : ANTÉCÉDENTS FAMILIAUX - CANCERS (DÉBUT - Partie 1/2)
  // ==========================================================================
  family_history: {
    title: "Antécédents Familiaux",
    icon: "👨‍👩‍👧‍👦",
    questions: [
      {
        id: 'atcdf_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '👨‍👩‍👧‍👦 Cette section évalue les antécédents familiaux de cancers et de maladies cardiovasculaires pour identifier les risques héréditaires.'
      },
      
      // === CANCERS FAMILIAUX ===
      {
        id: 'family_cancer_types',
        text: 'Y a-t-il des cancers dans votre famille proche (parents, frères/sœurs, enfants, grands-parents) ?',
        type: 'checkbox',
        required: true,
        helpText: 'Sélectionnez tous les types de cancers présents',
        options: [
          { value: 'breast', label: 'Cancer du sein' },
          { value: 'ovary', label: 'Cancer de l\'ovaire' },
          { value: 'prostate', label: 'Cancer de la prostate' },
          { value: 'colorectal', label: 'Cancer colorectal' },
          { value: 'skin', label: 'Mélanome / Cancer de la peau' },
          { value: 'pancreas', label: 'Cancer du pancréas' },
          { value: 'other', label: 'Autre type de cancer' },
          { value: 'none', label: 'Aucun cancer familial connu' }
        ]
      },

      // Cancer du Sein - Critères
      {
        id: 'family_cancer_breast_criteria',
        text: 'Cancer du sein familial : Y a-t-il ≥2 cas OU 1 cas avant 50 ans ?',
        type: 'radio',
        condition: 'family_cancer_breast_criteria',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_breast_details',
        text: 'Précisez les détails du cancer du sein familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_breast_details',
        cancerType: 'breast'
      },
      
      // Cancer de l'Ovaire - Critères
      {
        id: 'family_cancer_ovary_criteria',
        text: 'Cancer de l\'ovaire familial : Y a-t-il au moins 1 cas ?',
        type: 'radio',
        condition: 'family_cancer_ovary_criteria',
        helpText: 'Tout cancer de l\'ovaire familial est significatif en prévention',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_ovary_details',
        text: 'Précisez les détails du cancer de l\'ovaire familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_ovary_details',
        cancerType: 'ovary'
      },
      
      // Cancer de la Prostate - Critères
      {
        id: 'family_cancer_prostate_criteria',
        text: 'Cancer de la prostate familial : Y a-t-il ≥2 cas OU 1 cas avant 55 ans ?',
        type: 'radio',
        condition: 'family_cancer_prostate_criteria',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_prostate_details',
        text: 'Précisez les détails du cancer de la prostate familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_prostate_details',
        cancerType: 'prostate'
      },
      
      // Cancer Colorectal - Critères
      {
        id: 'family_cancer_colorectal_criteria',
        text: 'Cancer colorectal familial : Y a-t-il ≥2 cas OU 1 cas avant 50 ans ?',
        type: 'radio',
        condition: 'family_cancer_colorectal_criteria',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_colorectal_details',
        text: 'Précisez les détails du cancer colorectal familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_colorectal_details',
        cancerType: 'colorectal'
      },
      
      // Mélanome - Critères
      {
        id: 'family_cancer_skin_criteria',
        text: 'Mélanome familial : Y a-t-il ≥2 cas dans la famille ?',
        type: 'radio',
        condition: 'family_cancer_skin_criteria',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_skin_details',
        text: 'Précisez les détails du mélanome familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_skin_details',
        cancerType: 'skin'
      },
      
      // Cancer du Pancréas - Critères
      {
        id: 'family_cancer_pancreas_criteria',
        text: 'Cancer du pancréas familial : Y a-t-il ≥2 cas dans la famille ?',
        type: 'radio',
        condition: 'family_cancer_pancreas_criteria',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_cancer_pancreas_details',
        text: 'Précisez les détails du cancer du pancréas familial',
        type: 'family_cancer_simple',
        condition: 'family_cancer_pancreas_details',
        cancerType: 'pancreas'
      },

      // === BLOC CARDIOVASCULAIRE ===
      {
        id: 'family_cardiovascular',
        text: '❤️ BLOC CARDIOVASCULAIRE - Y a-t-il des antécédents cardiovasculaires dans votre famille ?',
        type: 'checkbox',
        required: true,
        helpText: 'Sélectionnez tous les antécédents cardiovasculaires présents dans votre famille au 1er degré (parents, frères, sœurs)',
        options: [
          { value: 'idm_avc_precoce', label: 'Infarctus ou AVC précoces (IDM homme <55 ans ou femme <65 ans / AVC <55 ans quel que soit le sexe)' },
          { value: 'mort_subite', label: 'Mort subite cardiaque avant 40 ans' },
          { value: 'hta_familiale', label: 'HTA familiale (au moins 2 membres au 1er degré)' },
          { value: 'none', label: 'Aucun antécédent cardiovasculaire connu' }
        ]
      },
      
      // === BLOC MÉTABOLIQUE ===
      {
        id: 'family_diabetes',
        text: '🔬 BLOC MÉTABOLIQUE - 👨‍👩‍👧 Y a-t-il des antécédents de diabète dans votre famille proche (parents, frères, sœurs) ?',
        type: 'checkbox',
        required: true,
        options: [
          { value: 'no', label: 'Non, aucun diabète dans la famille' },
          { value: 'type1', label: 'Diabète de type 1' },
          { value: 'type2', label: 'Diabète de type 2' },
          { value: 'gestational', label: 'Diabète gestationnel (mère ou sœur)' },
          { value: 'unknown_type', label: 'Diabète de type inconnu' }
        ]
      },
      {
        id: 'family_hypercholesterolemia',
        text: '👨‍👩‍👧 Y a-t-il des antécédents d\'hypercholestérolémie familiale dans votre famille proche (parents, frères, sœurs) ?',
        type: 'radio',
        required: true,
        helpText: 'Maladie génétique rare qui provoque un cholestérol très élevé dès le jeune âge',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui, diagnostiquée par un médecin' },
          { value: 'suspected', label: 'Suspectée (cholestérol très élevé chez plusieurs proches)' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      
      // === BLOC AUTRES FDRNM ===
      {
        id: 'family_thrombosis',
        text: '⚠️ BLOC AUTRES FDRNM - Y a-t-il des antécédents de thromboses veineuses dans votre famille ?',
        type: 'radio',
        required: true,
        helpText: 'Phlébites ou embolies pulmonaires répétées ou précoces (<50 ans) pouvant évoquer une thrombophilie héréditaire',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui (au moins 1 cas <50 ans ou récidivant)' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'family_osteoporosis',
        text: 'Y a-t-il des antécédents de fractures précoces/ostéoporose sévère dans votre famille ?',
        type: 'radio',
        required: true,
        helpText: 'Fractures avant 50 ans hors traumatisme majeur, ou ostéoporose sévère diagnostiquée jeune',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      
      // === BLOC GÉNÉTIQUE (conditionnel) ===
      {
        id: 'genetic_research_family',
        text: '🧬 BLOC GÉNÉTIQUE - Y a-t-il eu des recherches génétiques dans la famille en relation avec ces pathologies ?',
        type: 'radio',
        condition: 'genetic_research_question',
        helpText: 'Tests génétiques effectués chez un membre de la famille pour identifier des prédispositions héréditaires',
        options: [
          { value: 'no', label: 'Non' },
          { value: 'yes', label: 'Oui' },
          { value: 'unknown', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'genetic_markers_tested',
        text: 'Quels marqueurs génétiques ont été testés dans votre famille ?',
        type: 'checkbox_dynamic',
        condition: 'genetic_markers_tested',
        helpText: 'Seuls les marqueurs pertinents selon vos antécédents familiaux sont proposés'
      },
      {
        id: 'genetic_results_upload',
        text: 'Si vous avez des résultats écrits de ces tests génétiques, vous pouvez les joindre ici',
        type: 'iterative_upload',
        condition: 'genetic_results_upload',
        helpText: 'Comptes-rendus de laboratoire, courriers médicaux, etc. Formats acceptés : PDF, images (JPG, PNG), documents Word',
        acceptedFormats: '.pdf,.jpg,.jpeg,.png,.doc,.docx'
      }
    ]
  },


  // 6.4 : MODE DE VIE - FDRM

  lifestyle: {
    title: "Mode de Vie - FDRM",
    icon: "🏃‍♂️",
    questions: [
      {
        id: 'hygiene_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '💪 Cette section évalue vos comportements de santé : consommations, alimentation, activité physique.'
      },
      
      // ============ ASSIST - TABLE 2 COLONNES ============
      {
        id: 'assist_intro',
        text: 'Dépistage des consommations - ASSIST (OMS)',
        type: 'info',
        content: '🔬 Le test ASSIST de l\'OMS permet d\'identifier les consommations de substances.'
      },
      {
        id: 'assist_table',
        text: 'Avez-vous déjà consommé les substances suivantes ?',
        type: 'assist_table',
        required: true,
        helpText: 'Cochez "Vie entière" si vous avez déjà consommé, et "3 derniers mois" si vous avez consommé récemment',
        substances: [
          { id: 'tabac', label: 'Produits à base de tabac (cigarettes, cigares, pipe, chicha, etc.)' },
          { id: 'alcool', label: 'Boissons alcoolisées (bière, vin, spiritueux, etc.)' },
          { id: 'cannabis', label: 'Cannabis (marijuana, haschisch, herbe, shit, etc.)' },
          { id: 'cocaine', label: 'Cocaïne (coke, crack, freebase, etc.)' },
          { id: 'stimulants', label: 'Stimulants de type amphétamine (speed, ecstasy, MDMA, etc.)' },
          { id: 'sedatifs', label: 'Sédatifs ou somnifères (Valium, Xanax, Lexomil, etc.)' },
          { id: 'hallucinogenes', label: 'Hallucinogènes (LSD, champignons, kétamine, etc.)' },
          { id: 'opiaces', label: 'Opiacés (héroïne, morphine, méthadone, codéine, tramadol, etc.)' }
        ]
      },
      
      // ============ TABAC - QUESTIONS DE SUIVI ============
      {
        id: 'tabac_age_debut',
        text: 'À quel âge avez-vous commencé à fumer ?',
        type: 'number',
        condition: 'has_tabac_vie',
        required: false,
        helpText: 'Indiquez l\'âge approximatif de votre première cigarette'
      },
      {
        id: 'tabac_statut',
        text: 'Votre statut tabagique actuel',
        type: 'radio',
        condition: 'has_tabac_vie',
        required: true,
        options: [
          { value: 'fumeur_actuel', label: 'Fumeur actuel' },
          { value: 'ex_fumeur', label: 'Ex-fumeur (arrêt > 3 mois)' }
        ]
      },
      {
        id: 'tabac_quantite_actuelle',
        text: 'Combien de cigarettes fumez-vous par jour ?',
        type: 'number',
        condition: 'is_tabac_actuel',
        required: false,
        helpText: 'Nombre moyen de cigarettes par jour'
      },
      {
        id: 'tabac_arret_date',
        text: 'Depuis combien de temps avez-vous arrêté de fumer ?',
        type: 'radio',
        condition: 'is_tabac_ancien',
        required: false,
        options: [
          { value: '3-6mois', label: '3 à 6 mois' },
          { value: '6-12mois', label: '6 à 12 mois' },
          { value: '1-5ans', label: '1 à 5 ans' },
          { value: '>5ans', label: 'Plus de 5 ans' }
        ]
      },
      
      // ============ FAGERSTROM (conditionnel fumeur actuel) ============
      {
        id: 'fagerstrom_intro',
        text: 'Test de Fagerström - Dépendance nicotinique',
        type: 'info',
        condition: 'show_fagerstrom',
        content: '📋 Test validé pour évaluer la dépendance à la nicotine (6 questions).'
      },
      {
        id: 'fagerstrom_1',
        text: 'Combien de temps après le réveil fumez-vous votre première cigarette ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: 'Plus de 60 minutes' },
          { value: '1', label: '31 à 60 minutes' },
          { value: '2', label: '6 à 30 minutes' },
          { value: '3', label: 'Dans les 5 minutes' }
        ]
      },
      {
        id: 'fagerstrom_2',
        text: 'Trouvez-vous difficile de ne pas fumer dans les endroits interdits ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'fagerstrom_3',
        text: 'À quelle cigarette de la journée renonceriez-vous le plus difficilement ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: 'N\'importe laquelle sauf la première' },
          { value: '1', label: 'La première du matin' }
        ]
      },
      {
        id: 'fagerstrom_4',
        text: 'Combien de cigarettes fumez-vous par jour ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: '10 ou moins' },
          { value: '1', label: '11 à 20' },
          { value: '2', label: '21 à 30' },
          { value: '3', label: '31 ou plus' }
        ]
      },
      {
        id: 'fagerstrom_5',
        text: 'Fumez-vous plus durant les premières heures après le réveil que le reste de la journée ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'fagerstrom_6',
        text: 'Fumez-vous même si vous êtes malade au point de devoir rester au lit ?',
        type: 'radio',
        condition: 'show_fagerstrom',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      
      // ============ ALCOOL - QUESTIONS DE SUIVI ============
      {
        id: 'alcool_frequence',
        text: 'À quelle fréquence consommez-vous de l\'alcool actuellement ?',
        type: 'radio',
        condition: 'has_alcool_vie',
        required: true,
        options: [
          { value: 'quotidien', label: 'Quotidiennement' },
          { value: 'hebdo', label: 'Plusieurs fois par semaine' },
          { value: 'mensuel', label: 'Quelques fois par mois' },
          { value: 'occasionnel', label: 'Occasionnellement (fêtes, sorties)' },
          { value: 'jamais', label: 'Plus jamais (arrêt > 3 mois)' }
        ]
      },
      
      // ============ AUDIT (conditionnel consommateur alcool) ============
      {
        id: 'audit_intro',
        text: 'Test AUDIT - Usage d\'alcool',
        type: 'info',
        condition: 'show_audit',
        content: '📋 Test AUDIT (Alcohol Use Disorders Identification Test) pour dépister une consommation problématique d\'alcool (10 questions).'
      },
      {
        id: 'audit_1',
        text: 'À quelle fréquence vous arrive-t-il de consommer des boissons contenant de l\'alcool ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Une fois par mois ou moins' },
          { value: '2', label: '2 à 4 fois par mois' },
          { value: '3', label: '2 à 3 fois par semaine' },
          { value: '4', label: '4 fois ou plus par semaine' }
        ]
      },
      {
        id: 'audit_2',
        text: 'Combien de verres standard buvez-vous au cours d\'une journée ordinaire où vous buvez de l\'alcool ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        helpText: '1 verre standard = 10g d\'alcool pur (1 bière 25cl, 1 verre de vin 10cl, 1 dose de spiritueux 3cl)',
        options: [
          { value: '0', label: '1 ou 2' },
          { value: '1', label: '3 ou 4' },
          { value: '2', label: '5 ou 6' },
          { value: '3', label: '7 à 9' },
          { value: '4', label: '10 ou plus' }
        ]
      },
      {
        id: 'audit_3',
        text: 'Avec quelle fréquence buvez-vous 6 verres standard ou plus lors d\'une occasion particulière ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_4',
        text: 'Au cours de l\'année écoulée, combien de fois avez-vous constaté que vous n\'étiez plus capable de vous arrêter de boire une fois que vous aviez commencé ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_5',
        text: 'Au cours de l\'année écoulée, combien de fois le fait d\'avoir bu de l\'alcool vous a-t-il empêché de faire ce qui était normalement attendu de vous ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_6',
        text: 'Au cours de l\'année écoulée, combien de fois avez-vous eu besoin d\'un premier verre pour pouvoir démarrer après avoir beaucoup bu la veille ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_7',
        text: 'Au cours de l\'année écoulée, combien de fois avez-vous eu un sentiment de culpabilité ou des remords après avoir bu ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_8',
        text: 'Au cours de l\'année écoulée, combien de fois avez-vous été incapable de vous rappeler ce qui s\'était passé la soirée précédente parce que vous aviez bu ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Moins d\'une fois par mois' },
          { value: '2', label: 'Une fois par mois' },
          { value: '3', label: 'Une fois par semaine' },
          { value: '4', label: 'Tous les jours ou presque' }
        ]
      },
      {
        id: 'audit_9',
        text: 'Vous êtes-vous blessé(e) ou quelqu\'un d\'autre a-t-il été blessé parce que vous aviez bu ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '2', label: 'Oui, mais pas au cours de l\'année écoulée' },
          { value: '4', label: 'Oui, au cours de l\'année écoulée' }
        ]
      },
      {
        id: 'audit_10',
        text: 'Un parent, un ami, un médecin ou un autre soignant s\'est-il déjà préoccupé de votre consommation d\'alcool et vous a-t-il conseillé de la diminuer ?',
        type: 'radio',
        condition: 'show_audit',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '2', label: 'Oui, mais pas au cours de l\'année écoulée' },
          { value: '4', label: 'Oui, au cours de l\'année écoulée' }
        ]
      },
      
      // ============ CANNABIS - QUESTIONS DE SUIVI ============
      {
        id: 'cannabis_frequence',
        text: 'À quelle fréquence consommez-vous du cannabis actuellement ?',
        type: 'radio',
        condition: 'has_cannabis_vie',
        required: true,
        options: [
          { value: 'quotidien', label: 'Quotidiennement' },
          { value: 'hebdo', label: 'Plusieurs fois par semaine' },
          { value: 'mensuel', label: 'Quelques fois par mois' },
          { value: 'occasionnel', label: 'Occasionnellement' },
          { value: 'jamais', label: 'Plus jamais (arrêt > 3 mois)' }
        ]
      },
      
      // ============ CAST (conditionnel consommateur cannabis) ============
      {
        id: 'cast_intro',
        text: 'Test CAST - Usage de cannabis',
        type: 'info',
        condition: 'show_cast',
        content: '📋 Cannabis Abuse Screening Test - Outil de dépistage de l\'usage problématique de cannabis (6 questions).'
      },
      {
        id: 'cast_1',
        text: 'Avez-vous déjà fumé du cannabis avant midi ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      {
        id: 'cast_2',
        text: 'Avez-vous déjà fumé du cannabis lorsque vous étiez seul(e) ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      {
        id: 'cast_3',
        text: 'Avez-vous déjà eu des problèmes de mémoire quand vous fumez du cannabis ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      {
        id: 'cast_4',
        text: 'Des amis ou des membres de votre famille vous ont-ils déjà dit que vous devriez réduire votre consommation de cannabis ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      {
        id: 'cast_5',
        text: 'Avez-vous déjà essayé de réduire ou d\'arrêter votre consommation de cannabis sans y parvenir ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      {
        id: 'cast_6',
        text: 'Avez-vous déjà eu des problèmes à cause de votre consommation de cannabis (dispute, bagarre, accident, mauvais résultats scolaires, etc.) ?',
        type: 'radio',
        condition: 'show_cast',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Rarement' },
          { value: '2', label: 'De temps en temps' },
          { value: '3', label: 'Assez souvent' },
          { value: '4', label: 'Très souvent' }
        ]
      },
      
      // ============ ALIMENTATION - PNNS ============
      {
        id: 'pnns_intro',
        text: '🥗 Alimentation - PNNS',
        type: 'info',
        content: '📋 Programme National Nutrition Santé - Évaluation de vos habitudes alimentaires.'
      },
      {
        id: 'fruits_legumes',
        text: 'Consommation quotidienne de fruits et légumes ?',
        type: 'radio',
        required: true,
        helpText: '1 portion = 80-100g (ex: 1 pomme, 1 tomate, 1 poignée de haricots verts)',
        options: [
          { value: '0', label: 'Moins d\'1 portion par jour' },
          { value: '1-2', label: '1 à 2 portions par jour' },
          { value: '3-4', label: '3 à 4 portions par jour' },
          { value: '5+', label: '5 portions ou plus par jour (recommandé)' }
        ]
      },
      {
        id: 'produits_laitiers',
        text: 'Consommation quotidienne de produits laitiers ?',
        type: 'radio',
        required: true,
        helpText: 'Lait, yaourt, fromage',
        options: [
          { value: '0', label: 'Jamais ou rarement' },
          { value: '1-2', label: '1 à 2 portions par jour' },
          { value: '3+', label: '3 portions ou plus par jour (recommandé adultes)' }
        ]
      },
      {
        id: 'feculents',
        text: 'Consommation quotidienne de féculents ?',
        type: 'radio',
        required: true,
        helpText: 'Pain, pâtes, riz, pommes de terre, légumes secs',
        options: [
          { value: 'insuffisant', label: 'Moins d\'1 fois par jour' },
          { value: 'correct', label: '1 à 2 fois par jour' },
          { value: 'optimal', label: 'À chaque repas (recommandé)' }
        ]
      },
      {
        id: 'cereales_completes',
        text: 'Consommez-vous des céréales complètes ?',
        type: 'radio',
        required: true,
        helpText: 'Pain complet, pâtes complètes, riz complet, quinoa, etc.',
        options: [
          { value: 'jamais', label: 'Jamais ou rarement' },
          { value: 'parfois', label: 'Parfois' },
          { value: 'souvent', label: 'Souvent' },
          { value: 'quotidien', label: 'Tous les jours (recommandé)' }
        ]
      },
      {
        id: 'viande_poisson',
        text: 'Consommation de viande, poisson, œufs ?',
        type: 'radio',
        required: true,
        options: [
          { value: 'insuffisant', label: 'Moins d\'1 fois par jour' },
          { value: 'correct', label: '1 à 2 fois par jour (recommandé)' },
          { value: 'excessif', label: 'Plus de 2 fois par jour' }
        ]
      },
      {
        id: 'poisson_frequence',
        text: 'Fréquence de consommation de poisson ?',
        type: 'radio',
        required: true,
        helpText: 'Dont au moins 1 poisson gras (saumon, maquereau, sardines)',
        options: [
          { value: 'jamais', label: 'Jamais ou rarement' },
          { value: '1/mois', label: 'Environ 1 fois par mois' },
          { value: '1/sem', label: '1 fois par semaine' },
          { value: '2+/sem', label: '2 fois par semaine ou plus (recommandé)' }
        ]
      },
      {
        id: 'legumineuses',
        text: 'Consommation de légumineuses ?',
        type: 'radio',
        required: true,
        helpText: 'Lentilles, pois chiches, haricots secs, fèves',
        options: [
          { value: 'jamais', label: 'Jamais ou rarement' },
          { value: 'mensuel', label: 'Quelques fois par mois' },
          { value: 'hebdo', label: '1 à 2 fois par semaine' },
          { value: 'frequent', label: 'Plus de 2 fois par semaine (recommandé)' }
        ]
      },
      {
        id: 'matieres_grasses',
        text: 'Type de matières grasses principalement utilisées ?',
        type: 'checkbox',
        required: true,
        options: [
          { value: 'huile_olive', label: 'Huile d\'olive' },
          { value: 'huile_colza', label: 'Huile de colza' },
          { value: 'huile_noix', label: 'Huile de noix' },
          { value: 'beurre', label: 'Beurre' },
          { value: 'margarine', label: 'Margarine' },
          { value: 'autres', label: 'Autres huiles' }
        ]
      },
      {
        id: 'produits_sucres',
        text: 'Fréquence de consommation de produits sucrés ?',
        type: 'radio',
        required: true,
        helpText: 'Gâteaux, bonbons, chocolat, sodas, jus de fruits',
        options: [
          { value: 'quotidien_multi', label: 'Plusieurs fois par jour' },
          { value: 'quotidien', label: '1 fois par jour' },
          { value: 'hebdo', label: 'Quelques fois par semaine' },
          { value: 'occasionnel', label: 'Occasionnellement (recommandé)' }
        ]
      },
      {
        id: 'sel',
        text: 'Ajoutez-vous du sel à table (après cuisson) ?',
        type: 'radio',
        required: true,
        options: [
          { value: 'systematique', label: 'Systématiquement' },
          { value: 'souvent', label: 'Souvent' },
          { value: 'parfois', label: 'Parfois' },
          { value: 'rarement', label: 'Rarement ou jamais (recommandé)' }
        ]
      },
      {
        id: 'produits_transformes',
        text: 'Consommation de produits ultra-transformés ?',
        type: 'radio',
        required: true,
        helpText: 'Plats préparés industriels, fast-food, snacks salés, charcuterie',
        options: [
          { value: 'quotidien', label: 'Tous les jours ou presque' },
          { value: 'hebdo', label: 'Plusieurs fois par semaine' },
          { value: 'occasionnel', label: 'Occasionnellement' },
          { value: 'rare', label: 'Rarement ou jamais (recommandé)' }
        ]
      },
      {
        id: 'eau',
        text: 'Consommation quotidienne d\'eau ?',
        type: 'radio',
        required: true,
        options: [
          { value: '<1L', label: 'Moins d\'1 litre' },
          { value: '1-1.5L', label: '1 à 1,5 litre' },
          { value: '1.5L+', label: '1,5 litre ou plus (recommandé)' }
        ]
      },
      
      // ============ ACTIVITÉ PHYSIQUE - GPAQ ============
      {
        id: 'gpaq_intro',
        text: '🏃 Activité Physique - GPAQ',
        type: 'info',
        content: '📋 Global Physical Activity Questionnaire (OMS) - Évaluation de votre niveau d\'activité physique.'
      },
      {
        id: 'activite_intense_pro',
        text: 'Pratiquez-vous des activités physiques intenses dans le cadre de votre travail ou à la maison ?',
        type: 'radio',
        required: true,
        helpText: 'Activités qui provoquent une forte augmentation du rythme cardiaque et respiratoire (ex: porter des charges lourdes, bêcher, construction)',
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      {
        id: 'activite_intense_duree',
        text: 'Combien de temps par semaine pratiquez-vous ces activités intenses ?',
        type: 'radio',
        condition: 'has_activite_intense',
        required: false,
        options: [
          { value: '<150min', label: 'Moins de 2h30 par semaine' },
          { value: '150-300min', label: '2h30 à 5h par semaine' },
          { value: '>300min', label: 'Plus de 5h par semaine' }
        ]
      },
      {
        id: 'activite_moderee_pro',
        text: 'Pratiquez-vous des activités physiques modérées dans le cadre de votre travail ou à la maison ?',
        type: 'radio',
        required: true,
        helpText: 'Activités qui provoquent une légère augmentation du rythme cardiaque et respiratoire (ex: marche rapide, jardinage léger, nettoyage)',
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      {
        id: 'activite_moderee_duree',
        text: 'Combien de temps par semaine pratiquez-vous ces activités modérées ?',
        type: 'radio',
        condition: 'has_activite_moderee',
        required: false,
        options: [
          { value: '<150min', label: 'Moins de 2h30 par semaine' },
          { value: '150-300min', label: '2h30 à 5h par semaine' },
          { value: '>300min', label: 'Plus de 5h par semaine' }
        ]
      },
      {
        id: 'sport_loisirs',
        text: 'Pratiquez-vous un sport ou une activité physique de loisirs ?',
        type: 'radio',
        required: true,
        helpText: 'Natation, vélo, course à pied, fitness, danse, sports collectifs, etc.',
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      {
        id: 'sport_type',
        text: 'Quel(s) type(s) d\'activité(s) pratiquez-vous ?',
        type: 'checkbox',
        condition: 'has_sport',
        required: false,
        options: [
          { value: 'cardio', label: 'Cardio (course, vélo, natation)' },
          { value: 'musculation', label: 'Musculation / Renforcement' },
          { value: 'sports_collectifs', label: 'Sports collectifs' },
          { value: 'sports_raquette', label: 'Sports de raquette' },
          { value: 'yoga_pilates', label: 'Yoga / Pilates / Stretching' },
          { value: 'danse', label: 'Danse' },
          { value: 'autres', label: 'Autres' }
        ]
      },
      {
        id: 'sport_frequence',
        text: 'Fréquence de pratique sportive ?',
        type: 'radio',
        condition: 'has_sport',
        required: false,
        options: [
          { value: '1/mois', label: 'Moins d\'1 fois par semaine' },
          { value: '1-2/sem', label: '1 à 2 fois par semaine' },
          { value: '3-4/sem', label: '3 à 4 fois par semaine' },
          { value: '5+/sem', label: '5 fois ou plus par semaine' }
        ]
      },
      
      // ============ SÉDENTARITÉ + NMQ ============
      {
        id: 'sedentarite_intro',
        text: '💺 Sédentarité',
        type: 'info',
        content: '📋 Le temps passé assis quotidiennement est un facteur de risque indépendant, même si vous pratiquez une activité physique.'
      },
      {
        id: 'temps_assis_jour',
        text: 'Combien d\'heures passez-vous assis(e) par jour en moyenne (travail + loisirs) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '<4h', label: 'Moins de 4 heures' },
          { value: '4-6h', label: '4 à 6 heures' },
          { value: '6-8h', label: '6 à 8 heures' },
          { value: '8-10h', label: '8 à 10 heures' },
          { value: '>10h', label: 'Plus de 10 heures' }
        ]
      },
      {
        id: 'nmq_intro',
        text: 'NMQ - Troubles musculo-squelettiques',
        type: 'info',
        condition: 'is_sedentary',
        content: '📋 Nordic Musculoskeletal Questionnaire - Dépistage des troubles liés à la sédentarité.'
      },
      {
        id: 'nmq_cou',
        text: 'Avez-vous eu des douleurs ou troubles au COU au cours des 12 derniers mois ?',
        type: 'radio',
        condition: 'is_sedentary',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      {
        id: 'nmq_epaule',
        text: 'Avez-vous eu des douleurs ou troubles aux ÉPAULES au cours des 12 derniers mois ?',
        type: 'radio',
        condition: 'is_sedentary',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      },
      {
        id: 'nmq_dos',
        text: 'Avez-vous eu des douleurs ou troubles au BAS DU DOS (lombaires) au cours des 12 derniers mois ?',
        type: 'radio',
        condition: 'is_sedentary',
        required: false,
        options: [
          { value: 'non', label: 'Non' },
          { value: 'oui', label: 'Oui' }
        ]
      }
    ]
  },


  // 6.5 : BIEN ÊTRE PSYCHOLOGIQUE

  bien_etre_psy: {
    title: "Bien-être Psychologique",
    icon: "🧠",
    questions: [
      {
        id: 'psy_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '🧠 Évaluation avec tests validés scientifiquement.'
      },
      
      // ============ GAD-2 ============
      {
        id: 'gad2_intro',
        text: '😰 Dépistage anxiété - GAD-2',
        type: 'info',
        content: '📋 Si score ≥ 3, test complet proposé.'
      },
      {
        id: 'gad2_1',
        text: 'Au cours des 2 dernières semaines : Nerveux(se), anxieux(se) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'gad2_2',
        text: 'Incapable d\'empêcher de s\'inquiéter ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      
      // ============ GAD-7 COMPLET ============
      {
        id: 'gad7_intro',
        text: 'Test GAD-7 complet',
        type: 'info',
        condition: 'needs_gad7_full',
        content: '📋 Évaluation complète de l\'anxiété.'
      },
      {
        id: 'gad7_3',
        text: 'Se faire trop de souci ?',
        type: 'radio',
        condition: 'needs_gad7_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'gad7_4',
        text: 'Mal à se détendre ?',
        type: 'radio',
        condition: 'needs_gad7_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'gad7_5',
        text: 'Si agité(e) difficile de rester tranquille ?',
        type: 'radio',
        condition: 'needs_gad7_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'gad7_6',
        text: 'Facilement irritable ?',
        type: 'radio',
        condition: 'needs_gad7_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'gad7_7',
        text: 'Peur que quelque chose de terrible se passe ?',
        type: 'radio',
        condition: 'needs_gad7_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      
      // ============ PHQ-2 ============
      {
        id: 'phq2_intro',
        text: '😔 Dépistage dépression - PHQ-2',
        type: 'info',
        content: '📋 Si score ≥ 3, test complet proposé.'
      },
      {
        id: 'phq2_1',
        text: 'Au cours des 2 dernières semaines : Peu d\'intérêt/plaisir ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq2_2',
        text: 'Triste, déprimé(e), désespéré(e) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      
      // ============ PHQ-9 COMPLET ============
      {
        id: 'phq9_intro',
        text: 'Test PHQ-9 complet',
        type: 'info',
        condition: 'needs_phq9_full',
        content: '📋 Évaluation complète de l\'humeur.'
      },
      {
        id: 'phq9_3',
        text: 'Difficulté sommeil ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_4',
        text: 'Fatigué(e), peu d\'énergie ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_5',
        text: 'Peu d\'appétit ou trop manger ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_6',
        text: 'Mauvaise opinion de vous-même ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_7',
        text: 'Difficulté concentration ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_8',
        text: 'Ralentissement ou agitation ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      {
        id: 'phq9_9',
        text: 'Pensées de mort ou d\'auto-agression ?',
        type: 'radio',
        condition: 'needs_phq9_full',
        required: true,
        helpText: 'Si vous avez des pensées suicidaires, contactez immédiatement le 3114 (numéro national de prévention du suicide)',
        options: [
          { value: '0', label: 'Jamais' },
          { value: '1', label: 'Plusieurs jours' },
          { value: '2', label: 'Plus de la moitié du temps' },
          { value: '3', label: 'Presque tous les jours' }
        ]
      },
      
      // ============ SCOFF ============
      {
        id: 'scoff_intro',
        text: '🍽️ SCOFF - Dépistage troubles alimentaires',
        type: 'info',
        content: '📋 Test de dépistage des troubles du comportement alimentaire.'
      },
      {
        id: 'scoff_1',
        text: 'Vous faites-vous vomir parce que vous vous sentez mal d\'avoir trop mangé (S = Sick) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'scoff_2',
        text: 'Craignez-vous d\'avoir perdu le Contrôle des quantités que vous mangez (C = Control) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'scoff_3',
        text: 'Avez-vous récemment perdu plus de 6 kg en moins de 3 mois (O = One stone = 6kg) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'scoff_4',
        text: 'Pensez-vous être trop gros(se) alors que d\'autres vous trouvent trop mince (F = Fat) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'scoff_5',
        text: 'Diriez-vous que la nourriture domine votre vie (F = Food) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      
      // ============ WSAS ============
      {
        id: 'wsas_intro',
        text: '📊 WSAS - Retentissement fonctionnel',
        type: 'info',
        content: '📋 Work and Social Adjustment Scale - Évaluation de l\'impact sur votre vie quotidienne.'
      },
      {
        id: 'wsas_1',
        text: 'Impact sur votre capacité à travailler ?',
        type: 'radio',
        required: true,
        helpText: 'Si vous ne travaillez pas actuellement, évaluez l\'impact sur votre capacité à travailler',
        options: [
          { value: '0', label: '0 - Aucune gêne' },
          { value: '1', label: '1' },
          { value: '2', label: '2 - Légère gêne' },
          { value: '3', label: '3' },
          { value: '4', label: '4 - Gêne modérée' },
          { value: '5', label: '5' },
          { value: '6', label: '6 - Gêne importante' },
          { value: '7', label: '7' },
          { value: '8', label: '8 - Gêne très importante' }
        ]
      },
      {
        id: 'wsas_2',
        text: 'Impact sur votre gestion du foyer ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune gêne' },
          { value: '1', label: '1' },
          { value: '2', label: '2 - Légère gêne' },
          { value: '3', label: '3' },
          { value: '4', label: '4 - Gêne modérée' },
          { value: '5', label: '5' },
          { value: '6', label: '6 - Gêne importante' },
          { value: '7', label: '7' },
          { value: '8', label: '8 - Gêne très importante' }
        ]
      },
      {
        id: 'wsas_3',
        text: 'Impact sur vos loisirs ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune gêne' },
          { value: '1', label: '1' },
          { value: '2', label: '2 - Légère gêne' },
          { value: '3', label: '3' },
          { value: '4', label: '4 - Gêne modérée' },
          { value: '5', label: '5' },
          { value: '6', label: '6 - Gêne importante' },
          { value: '7', label: '7' },
          { value: '8', label: '8 - Gêne très importante' }
        ]
      },
      {
        id: 'wsas_4',
        text: 'Impact sur vos activités sociales privées ?',
        type: 'radio',
        required: true,
        helpText: 'Relations avec autrui, vie sociale',
        options: [
          { value: '0', label: '0 - Aucune gêne' },
          { value: '1', label: '1' },
          { value: '2', label: '2 - Légère gêne' },
          { value: '3', label: '3' },
          { value: '4', label: '4 - Gêne modérée' },
          { value: '5', label: '5' },
          { value: '6', label: '6 - Gêne importante' },
          { value: '7', label: '7' },
          { value: '8', label: '8 - Gêne très importante' }
        ]
      },
      {
        id: 'wsas_5',
        text: 'Impact sur vos relations familiales/de couple ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune gêne' },
          { value: '1', label: '1' },
          { value: '2', label: '2 - Légère gêne' },
          { value: '3', label: '3' },
          { value: '4', label: '4 - Gêne modérée' },
          { value: '5', label: '5' },
          { value: '6', label: '6 - Gêne importante' },
          { value: '7', label: '7' },
          { value: '8', label: '8 - Gêne très importante' }
        ]
      },
      
      // ============ ISI ============
      {
        id: 'isi_intro',
        text: '😴 ISI - Indice de Sévérité de l\'Insomnie',
        type: 'info',
        content: '📋 Test validé pour évaluer les troubles du sommeil.'
      },
      {
        id: 'isi_1',
        text: 'Difficulté à vous endormir ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune' },
          { value: '1', label: '1 - Légère' },
          { value: '2', label: '2 - Modérée' },
          { value: '3', label: '3 - Grave' },
          { value: '4', label: '4 - Très grave' }
        ]
      },
      {
        id: 'isi_2',
        text: 'Difficulté à rester endormi(e) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune' },
          { value: '1', label: '1 - Légère' },
          { value: '2', label: '2 - Modérée' },
          { value: '3', label: '3 - Grave' },
          { value: '4', label: '4 - Très grave' }
        ]
      },
      {
        id: 'isi_3',
        text: 'Problèmes de réveil trop tôt ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Aucun' },
          { value: '1', label: '1 - Léger' },
          { value: '2', label: '2 - Modéré' },
          { value: '3', label: '3 - Grave' },
          { value: '4', label: '4 - Très grave' }
        ]
      },
      {
        id: 'isi_4',
        text: 'Satisfaction vis-à-vis de votre sommeil actuel ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Très satisfait(e)' },
          { value: '1', label: '1 - Satisfait(e)' },
          { value: '2', label: '2 - Moyennement satisfait(e)' },
          { value: '3', label: '3 - Insatisfait(e)' },
          { value: '4', label: '4 - Très insatisfait(e)' }
        ]
      },
      {
        id: 'isi_5',
        text: 'Votre problème de sommeil est-il visible par les autres ?',
        type: 'radio',
        required: true,
        helpText: 'Détérioration de la qualité de vie due au problème de sommeil',
        options: [
          { value: '0', label: '0 - Pas du tout' },
          { value: '1', label: '1 - Un peu' },
          { value: '2', label: '2 - Quelque peu' },
          { value: '3', label: '3 - Beaucoup' },
          { value: '4', label: '4 - Énormément' }
        ]
      },
      {
        id: 'isi_6',
        text: 'Inquiétude par rapport à votre problème de sommeil ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: '0 - Pas du tout inquiet(e)' },
          { value: '1', label: '1 - Un peu inquiet(e)' },
          { value: '2', label: '2 - Quelque peu inquiet(e)' },
          { value: '3', label: '3 - Beaucoup inquiet(e)' },
          { value: '4', label: '4 - Très inquiet(e)' }
        ]
      },
      {
        id: 'isi_7',
        text: 'Interférence du problème de sommeil avec votre fonctionnement quotidien ?',
        type: 'radio',
        required: true,
        helpText: 'Fatigue, concentration, mémoire, humeur',
        options: [
          { value: '0', label: '0 - Pas du tout' },
          { value: '1', label: '1 - Un peu' },
          { value: '2', label: '2 - Quelque peu' },
          { value: '3', label: '3 - Beaucoup' },
          { value: '4', label: '4 - Énormément' }
        ]
      },
      
      // ============ STOP-BANG ============
      {
        id: 'stopbang_intro',
        text: '😪 STOP-BANG - Dépistage apnée du sommeil',
        type: 'info',
        content: '📋 Test de dépistage du syndrome d\'apnées obstructives du sommeil (SAOS).'
      },
      {
        id: 'stopbang_1',
        text: 'S - Ronflez-vous fort (suffisamment pour être entendu à travers une porte fermée) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_2',
        text: 'T - Vous sentez-vous souvent Fatigué(e), épuisé(e) ou somnolent(e) pendant la journée ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_3',
        text: 'O - Quelqu\'un a-t-il Observé que vous arrêtiez de respirer pendant votre sommeil ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_4',
        text: 'P - Avez-vous ou êtes-vous traité(e) pour une haute Pression sanguine (hypertension) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_5',
        text: 'B - Votre IMC est-il supérieur à 35 kg/m² ?',
        type: 'radio',
        required: true,
        helpText: 'L\'IMC sera calculé automatiquement à partir de votre poids et taille',
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_6',
        text: 'A - Âge supérieur à 50 ans ?',
        type: 'radio',
        required: true,
        helpText: 'Sera calculé automatiquement à partir de votre date de naissance',
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_7',
        text: 'N - Tour de Cou supérieur à 43 cm (homme) ou 41 cm (femme) ?',
        type: 'radio',
        required: true,
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      {
        id: 'stopbang_8',
        text: 'G - Genre masculin ?',
        type: 'radio',
        required: true,
        helpText: 'Sera rempli automatiquement selon votre sexe déclaré',
        options: [
          { value: '0', label: 'Non' },
          { value: '1', label: 'Oui' }
        ]
      },
      
      // ============ EPWORTH (conditionnel STOP-BANG positif) ============
      {
        id: 'epworth_intro',
        text: 'Échelle d\'Epworth - Somnolence diurne',
        type: 'info',
        condition: 'needs_epworth',
        content: '📋 Évaluation de la somnolence dans 8 situations de la vie quotidienne.'
      },
      {
        id: 'epworth_1',
        text: 'Situation 1 : Assis en lisant',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        helpText: 'Quelle est votre probabilité de vous assoupir ou de vous endormir ?',
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_2',
        text: 'Situation 2 : Regardant la télévision',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_3',
        text: 'Situation 3 : Assis inactif dans un lieu public',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        helpText: 'Théâtre, réunion',
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_4',
        text: 'Situation 4 : Passager d\'une voiture depuis 1 heure',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_5',
        text: 'Situation 5 : Allongé l\'après-midi',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_6',
        text: 'Situation 6 : Assis en parlant à quelqu\'un',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_7',
        text: 'Situation 7 : Assis tranquillement après un déjeuner sans alcool',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      },
      {
        id: 'epworth_8',
        text: 'Situation 8 : Au volant d\'une voiture immobilisée quelques minutes',
        type: 'radio',
        condition: 'needs_epworth',
        required: true,
        helpText: 'Dans un embouteillage ou à un feu rouge',
        options: [
          { value: '0', label: '0 - Aucune chance' },
          { value: '1', label: '1 - Faible chance' },
          { value: '2', label: '2 - Chance moyenne' },
          { value: '3', label: '3 - Forte chance' }
        ]
      }
    ]
  },

// 💡 Adapté selon l'âge, le sexe, la profession et les facteurs de risque

  vaccination: {
    title: "Vaccination",
    icon: "💉",
    questions: [
      {
        id: 'vaccination_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '💉 Cette section évalue votre statut vaccinal pour vous proposer des recommandations personnalisées selon les recommandations HAS et le calendrier vaccinal français.'
      },
      
      // ============ DTP + COQUELUCHE ============
      {
        id: 'dtp_statut',
        text: 'DTP (Diphtérie-Tétanos-Poliomyélite) - Quand avez-vous reçu votre dernier rappel ?',
        type: 'radio',
        required: true,
        helpText: 'Rappel recommandé tous les 10 ans (tous les 20 ans après 65 ans)',
        options: [
          { value: '<10ans', label: 'Moins de 10 ans (à jour)' },
          { value: '10-20ans', label: '10 à 20 ans' },
          { value: '>20ans', label: 'Plus de 20 ans' },
          { value: 'jamais', label: 'Jamais vacciné ou ne sait pas' },
          { value: 'inconnu', label: 'Ne sait pas' }
        ]
      },
      {
        id: 'coqueluche_adulte',
        text: 'Coqueluche - Avez-vous reçu un rappel à l\'âge adulte ?',
        type: 'radio',
        required: false,
        helpText: 'Recommandé à 25 ans, puis chez les adultes en contact avec des nourrissons',
        options: [
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
          { value: 'inconnu', label: 'Ne sait pas' }
        ]
      },
      
      // ============ ROR ============
      {
        id: 'ror_vaccination',
        text: 'ROR (Rougeole-Oreillons-Rubéole) - Statut vaccinal ?',
        type: 'radio',
        required: true,
        helpText: 'Recommandé : 2 doses pour toutes les personnes nées depuis 1980',
        options: [
          { value: '2doses', label: '2 doses reçues (protection optimale)' },
          { value: '1dose', label: '1 seule dose reçue' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sait pas' }
        ]
      },
      
      // ============ HÉPATITE B ============
      {
        id: 'hepatite_b_vaccination',
        text: 'Hépatite B - Statut vaccinal ?',
        type: 'radio',
        required: true,
        helpText: 'Obligatoire pour les nourrissons, recommandé pour tous jusqu\'à 15 ans et certaines professions',
        options: [
          { value: 'complet', label: 'Schéma complet (3 doses)' },
          { value: 'partiel', label: 'Schéma incomplet' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sait pas' }
        ]
      },
      
      // ============ HPV (conditionnel 11-26 ans) ============
      {
        id: 'hpv_vaccination',
        text: 'HPV (Papillomavirus) - Statut vaccinal ?',
        type: 'radio',
        condition: 'hpv_eligible',
        required: false,
        helpText: 'Recommandé de 11 à 14 ans (2 doses), rattrapage jusqu\'à 26 ans (3 doses). Désormais recommandé aussi pour les garçons.',
        options: [
          { value: 'complet', label: 'Schéma complet (2-3 doses selon l\'âge)' },
          { value: 'partiel', label: 'Schéma incomplet' },
          { value: 'non', label: 'Non vacciné(e)' }
        ]
      },
      {
        id: 'hpv_date',
        text: 'Date approximative de la dernière dose HPV',
        type: 'radio',
        condition: 'hpv_vaccinated',
        required: false,
        options: [
          { value: '<1an', label: 'Moins d\'1 an' },
          { value: '1-5ans', label: '1 à 5 ans' },
          { value: '>5ans', label: 'Plus de 5 ans' }
        ]
      },
      
      // ============ GRIPPE ============
      {
        id: 'grippe_eligible',
        text: 'Grippe - Êtes-vous concerné(e) par la vaccination antigrippale ?',
        type: 'radio',
        required: true,
        helpText: 'Recommandée si ≥65 ans, grossesse, maladie chronique, professionnel de santé',
        options: [
          { value: 'oui', label: 'Oui, je suis concerné(e)' },
          { value: 'non', label: 'Non' },
          { value: 'incertain', label: 'Pas sûr(e)' }
        ]
      },
      {
        id: 'grippe_last_season',
        text: 'Avez-vous reçu le vaccin grippe cette saison ou la saison dernière ?',
        type: 'radio',
        condition: 'grippe_eligible_yes',
        required: false,
        options: [
          { value: 'cette_saison', label: 'Oui, cette saison' },
          { value: 'saison_derniere', label: 'Oui, saison dernière' },
          { value: 'non', label: 'Non' }
        ]
      },
      
      // ============ COVID-19 ============
      {
        id: 'covid_vaccination_status',
        text: 'COVID-19 - Statut vaccinal',
        type: 'radio',
        required: true,
        options: [
          { value: 'primovaccination_complete', label: 'Primovaccination complète (2-3 doses selon le vaccin)' },
          { value: 'avec_rappels', label: 'Avec rappel(s)' },
          { value: 'incomplete', label: 'Schéma incomplet' },
          { value: 'non', label: 'Non vacciné(e)' }
        ]
      },
      {
        id: 'covid_last_dose',
        text: 'Date approximative de la dernière dose COVID-19',
        type: 'radio',
        condition: 'covid_vaccinated',
        required: false,
        helpText: 'Pour évaluer la nécessité d\'un rappel',
        options: [
          { value: '<6mois', label: 'Moins de 6 mois' },
          { value: '6-12mois', label: '6 à 12 mois' },
          { value: '>12mois', label: 'Plus de 12 mois' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ PNEUMOCOQUE ============
      {
        id: 'pneumocoque_vaccination',
        text: 'Pneumocoque',
        type: 'radio',
        required: false,
        helpText: 'Recommandé si ≥65 ans, immunodéprimé, maladie chronique respiratoire ou cardiaque',
        options: [
          { value: 'fait', label: 'Vacciné (VPC13 ou VPP23)' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ MÉNINGOCOQUE ============
      {
        id: 'meningocoque_vaccination',
        text: 'Méningocoque',
        type: 'radio',
        required: false,
        helpText: 'Recommandé pour les nourrissons, adolescents et certaines situations à risque',
        options: [
          { value: 'fait_c', label: 'Vacciné méningocoque C' },
          { value: 'fait_acwy', label: 'Vacciné méningocoque ACWY' },
          { value: 'fait_b', label: 'Vacciné méningocoque B' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ ZONA (conditionnel 65-74 ans) ============
      {
        id: 'zona_vaccination',
        text: 'Zona (Zostavax/Shingrix)',
        type: 'radio',
        condition: 'zona_eligible',
        required: false,
        helpText: 'Recommandé entre 65 et 74 ans (réduction des douleurs post-zostériennes)',
        options: [
          { value: 'fait', label: 'Vacciné' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ VACCINATIONS PROFESSIONNELLES ============
      {
        id: 'vaccins_professionnels_info',
        text: '👨‍⚕️ Vaccinations liées à votre profession',
        type: 'info',
        condition: 'vaccins_professionnels_needed',
        content: 'Selon votre profession, certains vaccins sont obligatoires ou fortement recommandés (Hépatite B, DTP, Rougeole, Grippe, COVID-19, Coqueluche, Varicelle, etc.)'
      },
      {
        id: 'hepatite_a_pro',
        text: 'Hépatite A - Vaccination professionnelle',
        type: 'radio',
        condition: 'hepatite_a_professional',
        required: false,
        helpText: 'Recommandé pour les professionnels de santé, petite enfance, restauration',
        options: [
          { value: 'fait', label: 'Vacciné' },
          { value: 'non', label: 'Non vacciné' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      {
        id: 'varicelle_pro',
        text: 'Varicelle - Vaccination professionnelle',
        type: 'radio',
        condition: 'varicelle_professional',
        required: false,
        helpText: 'Recommandé pour les professionnels de santé et petite enfance sans antécédent de varicelle',
        options: [
          { value: 'immunise', label: 'Immunisé (maladie contractée)' },
          { value: 'vaccine', label: 'Vacciné' },
          { value: 'non', label: 'Non immunisé/vacciné' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ VOYAGES ============
      {
        id: 'voyages_recents',
        text: 'Prévoyez-vous des voyages en zone tropicale ou équatoriale ?',
        type: 'radio',
        required: false,
        helpText: 'Certaines destinations nécessitent des vaccins spécifiques (fièvre jaune, encéphalite japonaise, etc.)',
        options: [
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' }
        ]
      },
      {
        id: 'voyages_zones',
        text: 'Destination(s) prévue(s)',
        type: 'checkbox',
        condition: 'voyages_zones_show',
        required: false,
        options: [
          { value: 'afrique', label: 'Afrique subsaharienne' },
          { value: 'asie_se', label: 'Asie du Sud-Est' },
          { value: 'amerique_sud', label: 'Amérique du Sud' },
          { value: 'moyen_orient', label: 'Moyen-Orient' },
          { value: 'autre', label: 'Autre zone tropicale' }
        ]
      },
      
      // ============ DOCUMENTS ============
      {
        id: 'carnet_vaccination_upload',
        text: 'Télécharger votre carnet de vaccination (optionnel)',
        type: 'iterative_upload',
        required: false,
        helpText: 'Vous pouvez joindre une photo de votre carnet de vaccination pour un suivi plus précis',
        acceptedFormats: '.pdf,.jpg,.jpeg,.png'
      }
    ]
  },

// 💡 Adapté selon âge, sexe, antécédents personnels et familiaux (HAS/INCa)

  depistages: {
    title: "Dépistages",
    icon: "🔬",
    questions: [
      {
        id: 'depistages_intro',
        text: 'Objectif de cette section',
        type: 'info',
        content: '🔬 Cette section évalue votre participation aux dépistages organisés et recommandés pour détecter précocement certains cancers et maladies. Recommandations basées sur HAS et INCa.'
      },
      
      // ============ CANCER COLORECTAL ============
      {
        id: 'depistage_colorectal_info',
        text: '🎗️ Dépistage du cancer COLORECTAL',
        type: 'info',
        condition: 'depistage_colorectal_eligible',
        content: '📋 Recommandé tous les 2 ans de 50 à 74 ans (test immunologique). Si antécédents familiaux : coloscopie selon recommandations.'
      },
      {
        id: 'depistage_colorectal_participe',
        text: 'Participez-vous au dépistage du cancer colorectal ?',
        type: 'radio',
        condition: 'depistage_colorectal_eligible',
        required: false,
        options: [
          { value: 'regulier', label: 'Oui, régulièrement (tous les 2 ans)' },
          { value: 'irregulier', label: 'Oui, mais irrégulièrement' },
          { value: 'coloscopie', label: 'Suivi par coloscopie (surveillance)' },
          { value: 'non', label: 'Non' }
        ]
      },
      {
        id: 'depistage_colorectal_date',
        text: 'Date du dernier dépistage colorectal',
        type: 'radio',
        condition: 'depistage_colorectal_fait',
        required: false,
        options: [
          { value: '<1an', label: 'Moins d\'1 an' },
          { value: '1-2ans', label: '1 à 2 ans' },
          { value: '>2ans', label: 'Plus de 2 ans' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      {
        id: 'coloscopie_surveillance',
        text: 'Avez-vous un suivi par coloscopie en raison d\'antécédents familiaux ?',
        type: 'radio',
        condition: 'coloscopie_surveillance_needed',
        required: false,
        helpText: 'Recommandé tous les 3-5 ans selon les risques',
        options: [
          { value: 'oui', label: 'Oui, suivi régulier' },
          { value: 'non', label: 'Non' }
        ]
      },
      
      // ============ CANCER DU SEIN ============
      {
        id: 'depistage_sein_info',
        text: '🎗️ Dépistage du cancer du SEIN',
        type: 'info',
        condition: 'depistage_sein_eligible',
        content: '📋 Mammographie tous les 2 ans de 50 à 74 ans (dépistage organisé). Si antécédents familiaux : dès 40 ans avec surveillance renforcée.'
      },
      {
        id: 'depistage_sein_participe',
        text: 'Participez-vous au dépistage du cancer du sein ?',
        type: 'radio',
        condition: 'depistage_sein_eligible',
        required: false,
        options: [
          { value: 'regulier', label: 'Oui, régulièrement (tous les 2 ans)' },
          { value: 'irregulier', label: 'Oui, mais irrégulièrement' },
          { value: 'surveillance_renforcee', label: 'Surveillance renforcée (risque élevé)' },
          { value: 'non', label: 'Non' }
        ]
      },
      {
        id: 'depistage_sein_date',
        text: 'Date de la dernière mammographie',
        type: 'radio',
        condition: 'depistage_sein_fait',
        required: false,
        options: [
          { value: '<1an', label: 'Moins d\'1 an' },
          { value: '1-2ans', label: '1 à 2 ans' },
          { value: '>2ans', label: 'Plus de 2 ans' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ CANCER COL UTÉRUS ============
      {
        id: 'depistage_col_info',
        text: '🎗️ Dépistage du cancer du COL DE L\'UTÉRUS',
        type: 'info',
        condition: 'depistage_col_eligible',
        content: '📋 Frottis tous les 3 ans de 25 à 65 ans (après 2 frottis normaux à 1 an d\'intervalle). Test HPV possible dès 30 ans.'
      },
      {
        id: 'depistage_col_participe',
        text: 'Participez-vous au dépistage du cancer du col de l\'utérus ?',
        type: 'radio',
        condition: 'depistage_col_eligible',
        required: false,
        options: [
          { value: 'regulier', label: 'Oui, régulièrement (tous les 3 ans)' },
          { value: 'irregulier', label: 'Oui, mais irrégulièrement' },
          { value: 'non', label: 'Non' }
        ]
      },
      {
        id: 'depistage_col_date',
        text: 'Date du dernier frottis cervico-utérin',
        type: 'radio',
        condition: 'depistage_col_fait',
        required: false,
        options: [
          { value: '<1an', label: 'Moins d\'1 an' },
          { value: '1-3ans', label: '1 à 3 ans' },
          { value: '>3ans', label: 'Plus de 3 ans' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ CANCER PROSTATE ============
      {
        id: 'depistage_prostate_info',
        text: '🎗️ Dépistage du cancer de la PROSTATE',
        type: 'info',
        condition: 'depistage_prostate_eligible',
        content: '📋 Discussion avec le médecin sur l\'intérêt du dosage PSA de 50 à 75 ans (dès 45 ans si antécédents familiaux ou d\'origine africaine/antillaise).'
      },
      {
        id: 'depistage_prostate_suivi',
        text: 'Avez-vous un suivi PSA pour le dépistage du cancer de la prostate ?',
        type: 'radio',
        condition: 'depistage_prostate_eligible',
        required: false,
        options: [
          { value: 'regulier', label: 'Oui, suivi régulier avec dosage PSA' },
          { value: 'occasionnel', label: 'Oui, occasionnellement' },
          { value: 'non', label: 'Non' }
        ]
      },
      {
        id: 'depistage_prostate_date',
        text: 'Date du dernier dosage PSA',
        type: 'radio',
        condition: 'depistage_prostate_fait',
        required: false,
        options: [
          { value: '<1an', label: 'Moins d\'1 an' },
          { value: '1-2ans', label: '1 à 2 ans' },
          { value: '>2ans', label: 'Plus de 2 ans' },
          { value: 'inconnu', label: 'Ne sais pas' }
        ]
      },
      
      // ============ MÉLANOME / PEAU ============
      {
        id: 'depistage_peau_info',
        text: '🔆 Surveillance cutanée - Mélanome',
        type: 'info',
        condition: 'depistage_peau_needed',
        content: '📋 Recommandé si antécédents familiaux de mélanome ou nombreux grains de beauté. Consultation dermatologique annuelle.'
      },
      {
        id: 'depistage_peau_suivi',
        text: 'Avez-vous un suivi dermatologique régulier ?',
        type: 'radio',
        condition: 'depistage_peau_needed',
        required: false,
        options: [
          { value: 'annuel', label: 'Oui, annuel' },
          { value: 'occasionnel', label: 'Oui, occasionnel' },
          { value: 'non', label: 'Non' }
        ]
      },
      
      // ============ GLAUCOME ============
      {
        id: 'depistage_glaucome',
        text: '👁️ Glaucome - Avez-vous déjà fait un dépistage ophtalmologique ?',
        type: 'radio',
        condition: 'depistage_glaucome_eligible',
        required: false,
        helpText: 'Recommandé dès 40 ans (mesure de la pression intraoculaire)',
        options: [
          { value: 'regulier', label: 'Oui, régulièrement' },
          { value: 'occasionnel', label: 'Oui, occasionnellement' },
          { value: 'non', label: 'Non' }
        ]
      },
      
      // ============ ANÉVRISME AORTE ============
      {
        id: 'depistage_anevrisme',
        text: 'Anévrisme de l\'aorte abdominale - Avez-vous fait une échographie de dépistage ?',
        type: 'radio',
        condition: 'depistage_anevrisme_eligible',
        required: false,
        helpText: 'Recommandé pour les hommes de 65 à 75 ans fumeurs ou ex-fumeurs',
        options: [
          { value: 'fait', label: 'Oui, fait' },
          { value: 'non', label: 'Non' },
          { value: 'ignore', label: 'Ne sais pas' }
        ]
      },
      
      // ============ OSTÉOPOROSE ============
      {
        id: 'depistage_osteoporose',
        text: 'Ostéoporose - Avez-vous fait une ostéodensitométrie (densitométrie osseuse) ?',
        type: 'radio',
        condition: 'depistage_osteoporose_eligible',
        required: false,
        helpText: 'Recommandé pour les femmes ménopausées ou ≥50 ans avec facteurs de risque (fractures, corticoïdes, maigreur)',
        options: [
          { value: 'fait', label: 'Oui, fait' },
          { value: 'non', label: 'Non' },
          { value: 'ignore', label: 'Ne sais pas' }
        ]
      },
      
      // ============ BILANS BIOLOGIQUES ============
      {
        id: 'depistage_biologique',
        text: 'Faites-vous des bilans biologiques réguliers ?',
        type: 'radio',
        required: false,
        helpText: 'Glycémie, cholestérol, fonction rénale, etc.',
        options: [
          { value: 'annuel', label: 'Oui, tous les ans' },
          { value: 'occasionnel', label: 'Oui, occasionnellement' },
          { value: 'non', label: 'Non, rarement ou jamais' }
        ]
      },
      
      // ============ DOCUMENTS ============
      {
        id: 'depistage_documents',
        text: 'Joindre des résultats de dépistages (optionnel)',
        type: 'iterative_upload',
        required: false,
        helpText: 'Comptes-rendus de mammographie, frottis, coloscopie, PSA, échographies, densitométries, etc.',
        acceptedFormats: '.pdf,.jpg,.jpeg,.png'
      }
    ]
  }
};


  // 3 : GESTION DES UPLOADS

  
  const handleFileUpload = (questionId, files) => {
    const currentFiles = responses[questionId] || [];
    const newFiles = Array.from(files).map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      uploadDate: new Date().toISOString()
    }));
    
    setResponses(prev => ({
      ...prev,
      [questionId]: [...currentFiles, ...newFiles]
    }));
  };

  const handleFileRemove = (questionId, fileIndex) => {
    setResponses(prev => {
      const currentFiles = prev[questionId] || [];
      const updatedFiles = currentFiles.filter((_, index) => index !== fileIndex);
      return {
        ...prev,
        [questionId]: updatedFiles.length > 0 ? updatedFiles : undefined
      };
    });
  };


  // 7 : FONCTIONS UTILITAIRES



  // Fonction pour formater une date
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR');
  };

  // Fonction pour calculer l'âge à partir de la date de naissance
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Fonction pour calculer l'IMC
  const calculateIMC = (weight, height) => {
    if (!weight || !height || height === 0) return null;
    const heightInMeters = height / 100;
    return (weight / (heightInMeters * heightInMeters)).toFixed(1);
  };

  // Fonction pour obtenir la catégorie IMC
  const getIMCCategory = (imc) => {
    if (!imc) return '';
    if (imc < 18.5) return 'Maigreur';
    if (imc < 25) return 'Normal';
    if (imc < 30) return 'Surpoids';
    if (imc < 35) return 'Obésité modérée';
    if (imc < 40) return 'Obésité sévère';
    return 'Obésité morbide';
  };


  // 8 : GESTION DES RÉPONSES



  const handleCheckboxOtherText = (questionId, text) => {
    setResponses(prev => ({
      ...prev,
      [`${questionId}_other_text`]: text
    }));
  };

  const handleRadioBodyZone = (questionId, zone, value) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [zone]: value
      }
    }));
  };


  // 9 : PROGRESSION & NAVIGATION


  // Calculer la progression pour une section donnée
  const calculateSectionProgress = (sectionKey) => {
    const section = sections[sectionKey];
    if (!section) return 0;

    const visibleQuestions = section.questions.filter(q => 
      shouldShowQuestion(q.condition)
    );

    const requiredQuestions = visibleQuestions.filter(q => q.required);
    if (requiredQuestions.length === 0) return 100;

    const answeredRequired = requiredQuestions.filter(q => {
      const response = responses[q.id];
      if (response === undefined || response === null || response === '') return false;
      if (Array.isArray(response) && response.length === 0) return false;
      if (typeof response === 'object' && Object.keys(response).length === 0) return false;
      return true;
    });

    return Math.round((answeredRequired.length / requiredQuestions.length) * 100);
  };

  // Calculer la progression globale
  const calculateOverallProgress = () => {
    const sectionKeys = Object.keys(sections);
    const totalProgress = sectionKeys.reduce((sum, key) => {
      return sum + calculateSectionProgress(key);
    }, 0);
    return Math.round(totalProgress / sectionKeys.length);
  };

  // Vérifier si une section est complète
  const isSectionComplete = (sectionKey) => {
    return calculateSectionProgress(sectionKey) === 100;
  };

  // Obtenir la prochaine section incomplète
  const getNextIncompleteSection = () => {
    const sectionKeys = Object.keys(sections);
    const currentIndex = sectionKeys.indexOf(currentSection);
    
    for (let i = currentIndex + 1; i < sectionKeys.length; i++) {
      if (!isSectionComplete(sectionKeys[i])) {
        return sectionKeys[i];
      }
    }
    
    // Si toutes les sections suivantes sont complètes, retourner null
    return null;
  };

  // Navigation entre sections
  const goToSection = (sectionKey) => {
    if (sections[sectionKey]) {
      setCurrentSection(sectionKey);
      // Scroll vers le haut
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextSection = () => {
    const sectionKeys = Object.keys(sections);
    const currentIndex = sectionKeys.indexOf(currentSection);
    if (currentIndex < sectionKeys.length - 1) {
      goToSection(sectionKeys[currentIndex + 1]);
    }
  };

  const goToPreviousSection = () => {
    const sectionKeys = Object.keys(sections);
    const currentIndex = sectionKeys.indexOf(currentSection);
    if (currentIndex > 0) {
      goToSection(sectionKeys[currentIndex - 1]);
    }
  };

  // Validation de la section courante
  const validateCurrentSection = () => {
    const section = sections[currentSection];
    const visibleQuestions = section.questions.filter(q => 
      shouldShowQuestion(q.condition)
    );
    const requiredQuestions = visibleQuestions.filter(q => q.required);
    
    const unanswered = requiredQuestions.filter(q => {
      const response = responses[q.id];
      if (response === undefined || response === null || response === '') return true;
      if (Array.isArray(response) && response.length === 0) return true;
      if (typeof response === 'object' && Object.keys(response).length === 0) return true;
      return false;
    });

    if (unanswered.length > 0) {
      alert(`Veuillez répondre à toutes les questions obligatoires (${unanswered.length} restante(s))`);
      return false;
    }
    
    return true;
  };

  // Sauvegarder les réponses (localStorage simulé en mémoire)
  const saveResponses = () => {
    // Note: localStorage n'est pas supporté dans les artifacts Claude
    // On simule juste la sauvegarde en mémoire
    console.log('Réponses sauvegardées:', responses);
    alert('✅ Vos réponses ont été sauvegardées avec succès !');
  };

  // Réinitialiser le questionnaire
  const resetQuestionnaire = () => {
    if (window.confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser le questionnaire ? Toutes vos réponses seront perdues.')) {
      setResponses({});
      setCurrentSection('identite');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Exporter les réponses en JSON
  const exportResponses = () => {
    const dataStr = JSON.stringify(responses, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prevgo_responses_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Obtenir le résumé des réponses
  const getResponsesSummary = () => {
    const summary = {
      totalQuestions: 0,
      answeredQuestions: 0,
      sectionsCompleted: 0,
      totalSections: Object.keys(sections).length,
      overallProgress: calculateOverallProgress(),
      sections: {}
    };

    Object.keys(sections).forEach(sectionKey => {
      const section = sections[sectionKey];
      const visibleQuestions = section.questions.filter(q => 
        shouldShowQuestion(q.condition)
      );
      const requiredQuestions = visibleQuestions.filter(q => q.required);
      
      const answeredRequired = requiredQuestions.filter(q => {
        const response = responses[q.id];
        if (response === undefined || response === null || response === '') return false;
        if (Array.isArray(response) && response.length === 0) return false;
        if (typeof response === 'object' && Object.keys(response).length === 0) return false;
        return true;
      });

      const progress = calculateSectionProgress(sectionKey);
      
      summary.sections[sectionKey] = {
        title: section.title,
        totalQuestions: visibleQuestions.length,
        requiredQuestions: requiredQuestions.length,
        answeredQuestions: answeredRequired.length,
        progress: progress,
        isComplete: progress === 100
      };

      summary.totalQuestions += visibleQuestions.length;
      summary.answeredQuestions += answeredRequired.length;
      if (progress === 100) summary.sectionsCompleted++;
    });

    return summary;
  };

  // État pour afficher/masquer le résumé
  const [showSummary, setShowSummary] = React.useState(false);

  // Toggle résumé
  const toggleSummary = () => {
    setShowSummary(!showSummary);
  };


  // 10 : RENDU DES TYPES DE QUESTIONS


  const renderQuestion = (question) => {
    if (!shouldShowQuestion(question.condition)) return null;

    const commonClasses = "mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200";

    switch (question.type) {
      case 'info':
        return (
          <div key={question.id} className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <div className="flex items-start">
              <Info className="w-5 h-5 text-blue-500 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">{question.text}</p>
                <p className="text-blue-800 text-sm whitespace-pre-line">{question.content}</p>
              </div>
            </div>
          </div>
        );

      case 'radio':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3 flex items-start">
                <HelpCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                {question.helpText}
              </p>
            )}
            <div className="space-y-2">
              {question.options.map(option => (
                <label key={option.value} className="flex items-center p-3 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name={question.id}
                    value={option.value}
                    checked={responses[question.id] === option.value}
                    onChange={(e) => handleResponse(question.id, e.target.value, 'radio')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="ml-3 text-gray-900">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'checkbox':
      case 'checkbox_grouped':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3 flex items-start">
                <HelpCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                {question.helpText}
              </p>
            )}
            <div className="space-y-2">
              {question.options.map(option => {
                const isChecked = (responses[question.id] || []).includes(option.value);
                return (
                  <label key={option.value} className="flex items-center p-3 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={isChecked}
                      onChange={(e) => handleResponse(question.id, option.value, 'checkbox')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-gray-900">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      case 'checkbox_with_other':
        const selectedValues = responses[question.id] || [];
        const hasOther = selectedValues.includes('autre');
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3 flex items-start">
                <HelpCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                {question.helpText}
              </p>
            )}
            <div className="space-y-2">
              {question.options.map(option => {
                const isChecked = selectedValues.includes(option.value);
                return (
                  <label key={option.value} className="flex items-center p-3 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={isChecked}
                      onChange={(e) => handleResponse(question.id, option.value, 'checkbox_with_other')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-gray-900">{option.label}</span>
                  </label>
                );
              })}
            </div>
            {hasOther && (
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Précisez..."
                  value={responses[`${question.id}_other_text`] || ''}
                  onChange={(e) => handleCheckboxOtherText(question.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        );

      case 'text':
      case 'email':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <input
              type={question.type}
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value, question.type)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={question.helpText || ''}
            />
          </div>
        );

      case 'number':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <input
              type="number"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value, 'number')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={question.min}
              max={question.max}
            />
          </div>
        );

      case 'date':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <input
              type="date"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value, 'date')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <textarea
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value, 'textarea')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              placeholder={question.helpText || ''}
            />
          </div>
        );

      case 'ancestry_table':
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">Parent</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Pays/Région de naissance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Mère</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        value={(responses[question.id] || {}).mere || ''}
                        onChange={(e) => handleResponse(question.id, { mere: e.target.value }, 'ancestry_table')}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Ex: France, Algérie, Vietnam..."
                      />
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-medium">Père</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <input
                        type="text"
                        value={(responses[question.id] || {}).pere || ''}
                        onChange={(e) => handleResponse(question.id, { pere: e.target.value }, 'ancestry_table')}
                        className="w-full px-2 py-1 border border-gray-300 rounded"
                        placeholder="Ex: France, Maroc, Sénégal..."
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'auto_mesures_table':
        const mesuresData = responses[question.id] || {};
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Poids (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mesuresData.poids || ''}
                  onChange={(e) => handleResponse(question.id, { ...mesuresData, poids: e.target.value }, 'auto_mesures_table')}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Ex: 70.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Taille (cm)</label>
                <input
                  type="number"
                  value={mesuresData.taille || ''}
                  onChange={(e) => handleResponse(question.id, { ...mesuresData, taille: e.target.value }, 'auto_mesures_table')}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Ex: 175"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Périmètre abdominal (cm)</label>
                <input
                  type="number"
                  value={mesuresData.perimetre || ''}
                  onChange={(e) => handleResponse(question.id, { ...mesuresData, perimetre: e.target.value }, 'auto_mesures_table')}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Ex: 85"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tension artérielle</label>
                <input
                  type="text"
                  value={mesuresData.tension || ''}
                  onChange={(e) => handleResponse(question.id, { ...mesuresData, tension: e.target.value }, 'auto_mesures_table')}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="Ex: 120/80"
                />
              </div>
            </div>
            {mesuresData.poids && mesuresData.taille && (
              <div className="mt-4 p-3 bg-blue-50 rounded">
                <p className="text-sm font-medium text-blue-900">
                  IMC calculé : {calculateIMC(mesuresData.poids, mesuresData.taille)} - {getIMCCategory(calculateIMC(mesuresData.poids, mesuresData.taille))}
                </p>
              </div>
            )}
          </div>
        );

      case 'assist_table':
        const assistData = responses[question.id] || {};
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Substance</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Vie entière</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">3 derniers mois</th>
                  </tr>
                </thead>
                <tbody>
                  {question.substances.map(substance => (
                    <tr key={substance.id}>
                      <td className="border border-gray-300 px-3 py-2">{substance.label}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={assistData[substance.id]?.vie || false}
                          onChange={(e) => handleResponse(question.id, {
                            ...assistData,
                            [substance.id]: {
                              ...assistData[substance.id],
                              vie: e.target.checked
                            }
                          }, 'assist_table')}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={assistData[substance.id]?.trois_mois || false}
                          onChange={(e) => handleResponse(question.id, {
                            ...assistData,
                            [substance.id]: {
                              ...assistData[substance.id],
                              trois_mois: e.target.checked
                            }
                          }, 'assist_table')}
                          className="w-4 h-4"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'iterative_upload':
        const uploadedFiles = responses[question.id] || [];
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3">{question.helpText}</p>
            )}
            
            {uploadedFiles.length > 0 && (
              <div className="mb-3 space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center flex-1">
                      <FileText className="w-4 h-4 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      onClick={() => handleFileRemove(question.id, index)}
                      className="text-red-600 hover:text-red-800"
                      title="Supprimer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept={question.acceptedFormats}
                multiple
                onChange={(e) => handleFileUpload(question.id, e.target.files)}
                className="hidden"
                id={`upload-${question.id}`}
              />
              <label htmlFor={`upload-${question.id}`} className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Cliquez pour ajouter des fichiers</p>
                <p className="text-xs text-gray-500 mt-1">Formats acceptés : {question.acceptedFormats}</p>
              </label>
            </div>
          </div>
        );

      case 'checkbox_dynamic':
        // Pour les marqueurs génétiques dynamiques
        const availableMarkers = [];
        const familyCancers = responses.family_cancer_types || [];
        
        if (familyCancers.includes('breast') || familyCancers.includes('ovary')) {
          availableMarkers.push({ value: 'brca1', label: 'BRCA1' });
          availableMarkers.push({ value: 'brca2', label: 'BRCA2' });
        }
        if (familyCancers.includes('colorectal')) {
          availableMarkers.push({ value: 'lynch', label: 'Syndrome de Lynch (MLH1, MSH2, MSH6, PMS2)' });
          availableMarkers.push({ value: 'paf', label: 'PAF (gène APC)' });
        }
        if (familyCancers.includes('skin')) {
          availableMarkers.push({ value: 'cdkn2a', label: 'CDKN2A (mélanome familial)' });
        }
        
        if (availableMarkers.length === 0) {
          availableMarkers.push({ value: 'autre', label: 'Autre marqueur génétique' });
        }

        const selectedMarkers = responses[question.id] || [];
        
        return (
          <div key={question.id} className={commonClasses}>
            <label className="block text-gray-900 font-medium mb-3">
              {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {question.helpText && (
              <p className="text-sm text-gray-600 mb-3 flex items-start">
                <HelpCircle className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                {question.helpText}
              </p>
            )}
            <div className="space-y-2">
              {availableMarkers.map(marker => {
                const isChecked = selectedMarkers.includes(marker.value);
                return (
                  <label key={marker.value} className="flex items-center p-3 rounded border border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      value={marker.value}
                      checked={isChecked}
                      onChange={(e) => handleResponse(question.id, marker.value, 'checkbox_dynamic')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="ml-3 text-gray-900">{marker.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );

      default:
        return (
          <div key={question.id} className={commonClasses}>
            <p className="text-red-500">Type de question non supporté : {question.type}</p>
          </div>
        );
    }
  };


  // 11 : INTERFACE PRINCIPALE


  const currentSectionData = sections[currentSection];
  const sectionKeys = Object.keys(sections);
  const currentIndex = sectionKeys.indexOf(currentSection);
  const overallProgress = calculateOverallProgress();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">PrevGo - Questionnaire Médical</h1>
          <p className="text-blue-100">Questionnaire d'Anamnèse Structurée pour Consultation de Médecine Générale</p>
          
          {/* Barre de progression globale */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progression globale</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full bg-blue-900 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Navigation sections */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center space-x-2 overflow-x-auto">
            {sectionKeys.map((key, index) => {
              const section = sections[key];
              const progress = calculateSectionProgress(key);
              const isActive = key === currentSection;
              const isComplete = progress === 100;
              
              return (
                <button
                  key={key}
                  onClick={() => goToSection(key)}
                  className={`flex items-center px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : isComplete
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  <span className="text-sm font-medium">{section.title}</span>
                  {isComplete && <Check className="w-4 h-4 ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* En-tête de section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <span className="text-4xl mr-4">{currentSectionData.icon}</span>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{currentSectionData.title}</h2>
              <div className="mt-2">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Progression de cette section</span>
                  <span>{calculateSectionProgress(currentSection)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 rounded-full h-2 transition-all duration-300"
                    style={{ width: `${calculateSectionProgress(currentSection)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-6">
          {currentSectionData.questions.map(question => renderQuestion(question))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={goToPreviousSection}
            disabled={currentIndex === 0}
            className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
              currentIndex === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Section précédente
          </button>

          <div className="flex space-x-3">
            <button
              onClick={saveResponses}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              <Save className="w-5 h-5 mr-2" />
              Sauvegarder
            </button>

            {currentIndex < sectionKeys.length - 1 ? (
              <button
                onClick={goToNextSection}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Section suivante
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (overallProgress === 100) {
                    alert('✅ Questionnaire terminé ! Vos réponses ont été enregistrées.');
                    toggleSummary();
                  } else {
                    alert('⚠️ Veuillez compléter toutes les sections avant de terminer.');
                  }
                }}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                <Check className="w-5 h-5 mr-2" />
                Terminer
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex space-x-4">
              <button
                onClick={toggleSummary}
                className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                <FileText className="w-5 h-5 mr-2" />
                {showSummary ? 'Masquer' : 'Afficher'} le résumé
              </button>
              <button
                onClick={exportResponses}
                className="flex items-center text-blue-600 hover:text-blue-800 font-medium"
              >
                <Download className="w-5 h-5 mr-2" />
                Exporter (JSON)
              </button>
            </div>
            <button
              onClick={resetQuestionnaire}
              className="flex items-center text-red-600 hover:text-red-800 font-medium"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              Réinitialiser
            </button>
          </div>

          {/* Résumé */}
          {showSummary && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-bold text-lg mb-3">📊 Résumé du questionnaire</h3>
              {(() => {
                const summary = getResponsesSummary();
                return (
                  <div className="space-y-2 text-sm">
                    <p><strong>Progression globale :</strong> {summary.overallProgress}%</p>
                    <p><strong>Sections complétées :</strong> {summary.sectionsCompleted} / {summary.totalSections}</p>
                    <div className="mt-3">
                      <p className="font-medium mb-2">Détail par section :</p>
                      <div className="space-y-1">
                        {Object.keys(summary.sections).map(key => {
                          const sectionSummary = summary.sections[key];
                          return (
                            <div key={key} className="flex justify-between items-center">
                              <span>{sectionSummary.title}</span>
                              <span className={`font-medium ${sectionSummary.isComplete ? 'text-green-600' : 'text-orange-600'}`}>
                                {sectionSummary.progress}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>PrevGo v30 - Questionnaire Médical Structuré © 2025</p>
            <p className="mt-1">Conforme aux recommandations HAS • INCa • PNNS • GPAQ</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PrevGoQuestionnaire;