#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Referencime MCP Server - Version finale avec SDK officiel
 * Compatible avec Claude Desktop
 */

// Schema definitions pour nos outils SEO
const AnalyzeKeywordArgsSchema = z.object({
  keyword: z.string().describe('Le mot-clé à analyser'),
  website_id: z.number().describe('ID du site web dans Referencime')
});

const PositionEvolutionArgsSchema = z.object({
  keyword: z.string().describe('Le mot-clé à analyser'),
  website_id: z.number().describe('ID du site web dans Referencime'),
  period: z.string().optional().default('30days').describe('Période d\'analyse (7days, 30days, 90days)')
});

const CompareKeywordsArgsSchema = z.object({
  keywords: z.array(z.string()).describe('Liste des mots-clés à comparer'),
  website_id: z.number().describe('ID du site web dans Referencime')
});

const WebsiteSummaryArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  period: z.string().optional().default('30days').describe('Période d\'analyse (7days, 30days, 90days)'),
  start_date: z.string().optional().describe('Date de début au format YYYY-MM-DD'),
  end_date: z.string().optional().describe('Date de fin au format YYYY-MM-DD'),
  compare_start_date: z.string().optional().describe('Date de début de comparaison au format YYYY-MM-DD'),
  compare_end_date: z.string().optional().describe('Date de fin de comparaison au format YYYY-MM-DD')
});

const RankingChangesArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  days: z.number().optional().default(7).describe('Nombre de jours à analyser'),
  threshold: z.number().optional().default(3).describe('Seuil de changement de position'),
  start_date: z.string().optional().describe('Date de début au format YYYY-MM-DD'),
  end_date: z.string().optional().describe('Date de fin au format YYYY-MM-DD')
});

const ListUserWebsitesArgsSchema = z.object({
  // Aucun paramètre requis - utilise la clé API pour identifier l'utilisateur
});

const GetKeywordsByCategoriesArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  include_performance: z.boolean().optional().default(true).describe('Inclure les métriques de performance GSC'),
  days: z.number().optional().default(30).describe('Période pour les métriques (en jours)')
});

// Configuration du serveur
const server = new Server(
  {
    name: "referencime-mcp-server",
    version: "1.1.3",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Vérification de la clé API
function getApiKey() {
  const apiKey = process.env.REFERENCIME_API_KEY;
  if (!apiKey) {
    throw new Error('REFERENCIME_API_KEY non configuré. Ajoutez votre clé API dans la configuration Claude Desktop.');
  }
  return apiKey;
}

// Appel à la vraie API Referencime WordPress
async function callReferencimeAPI(toolName, args) {
  const apiKey = getApiKey();
  
  // Configuration de base pour tous les appels API
  const baseURL = 'https://referencime.fr/wp-json/easy-links/v1';
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };

  try {
    let endpoint = '';
    let requestData = args;

    // Mappage des outils MCP vers les endpoints WordPress
    switch (toolName) {
      case 'analyze_keyword_performance':
        endpoint = '/ai/analyze-keyword-performance';
        break;
      case 'get_position_evolution':
        endpoint = '/ai/get-position-evolution';
        break;
      case 'compare_keywords_performance':
        endpoint = '/ai/compare-keywords-performance';
        break;
      case 'get_website_performance_summary':
        endpoint = '/ai/get-website-performance-summary';
        break;
      case 'detect_ranking_changes':
        endpoint = '/ai/detect-ranking-changes';
        break;
      case 'list_user_websites':
        endpoint = '/ai/list-user-websites';
        break;
      case 'get_keywords_by_categories':
        endpoint = '/ai/get-keywords-by-categories';
        break;
      default:
        throw new Error(`Outil inconnu: ${toolName}`);
    }

    // Appel HTTP vers l'API WordPress
    const response = await fetch(`${baseURL}${endpoint}`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`Erreur API WordPress: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`Erreur dans la réponse API: ${result.message || 'Erreur inconnue'}`);
    }

    return result.data;

  } catch (error) {
    console.error(`[Referencime MCP] Erreur API ${toolName}:`, error.message);
    throw error;
  }
}

// Handler pour lister les outils disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_keyword_performance",
        description: "Analyse complète des performances d'un mot-clé spécifique : position actuelle, volume de recherche, difficulté, trafic estimé et tendances.",
        inputSchema: zodToJsonSchema(AnalyzeKeywordArgsSchema),
      },
      {
        name: "get_position_evolution",
        description: "Évolution historique des positions d'un mot-clé dans les SERP avec données de clics, impressions et analyse des tendances sur la période sélectionnée.",
        inputSchema: zodToJsonSchema(PositionEvolutionArgsSchema),
      },
      {
        name: "compare_keywords_performance",
        description: "Comparaison détaillée des performances de plusieurs mots-clés avec recommandations d'optimisation et identification du meilleur performer.",
        inputSchema: zodToJsonSchema(CompareKeywordsArgsSchema),
      },
      {
        name: "get_website_performance_summary",
        description: "Tableau de bord complet des performances SEO d'un site web : métriques globales, évolution des positions et mots-clés les plus performants.",
        inputSchema: zodToJsonSchema(WebsiteSummaryArgsSchema),
      },
      {
        name: "detect_ranking_changes",
        description: "Détection automatique des changements significatifs de positions SERP avec alertes et recommandations d'actions prioritaires.",
        inputSchema: zodToJsonSchema(RankingChangesArgsSchema),
      },
      {
        name: "list_user_websites",
        description: "Liste tous les sites web auxquels l'utilisateur a accès dans son compte Referencime avec leurs IDs et noms de domaine.",
        inputSchema: zodToJsonSchema(ListUserWebsitesArgsSchema),
      },
      {
        name: "get_keywords_by_categories",
        description: "Récupère tous les mots-clés d'un site web organisés par catégories avec métriques de performance GSC optionnelles et analyse thématique SEO.",
        inputSchema: zodToJsonSchema(GetKeywordsByCategoriesArgsSchema),
      },
    ],
  };
});

// Handler pour exécuter les outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "analyze_keyword_performance": {
        const parsed = AnalyzeKeywordArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour analyze_keyword_performance: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        return {
          content: [
            {
              type: "text",
              text: `🔍 **ANALYSE COMPLÈTE DU MOT-CLÉ "${parsed.data.keyword.toUpperCase()}"**\n\n` +
                    `📊 **Métriques actuelles :**\n` +
                    `• Position actuelle : #${result.current_position}\n` +
                    `• Volume de recherche : ${result.search_volume.toLocaleString()} recherches/mois\n` +
                    `• Difficulté SEO : ${result.difficulty_score}/100\n` +
                    `• Trafic estimé : ${result.estimated_traffic.toLocaleString()} visites/mois\n` +
                    `• Niveau de concurrence : ${result.competition_level}\n` +
                    `• Tendance : ${result.trend}\n\n` +
                    `📅 **Dernière mise à jour :** ${new Date(result.last_updated).toLocaleString('fr-FR')}\n` +
                    `🌐 **Site web ID :** ${result.website_id}`
            }
          ]
        };
      }

      case "get_position_evolution": {
        const parsed = PositionEvolutionArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour get_position_evolution: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        const chartData = result.historical_positions.map(p => 
          `${p.date}: Position #${p.position} (${p.clicks} clics, ${p.impressions} impressions)`
        ).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `📈 **ÉVOLUTION DES POSITIONS - "${parsed.data.keyword.toUpperCase()}"**\n\n` +
                    `⏱️ **Période analysée :** ${result.period}\n` +
                    `📊 **Statistiques :**\n` +
                    `• Meilleure position : #${result.best_position}\n` +
                    `• Position moyenne : #${result.average_position}\n` +
                    `• Évolution récente : ${result.position_change > 0 ? '+' : ''}${result.position_change} positions\n\n` +
                    `📅 **Historique détaillé :**\n${chartData}\n\n` +
                    `🌐 **Site web ID :** ${result.website_id}`
            }
          ]
        };
      }

      case "compare_keywords_performance": {
        const parsed = CompareKeywordsArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour compare_keywords_performance: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        const comparison = result.keywords_analysis.map(k => 
          `• **${k.keyword}**: Position #${k.position} | Volume: ${k.search_volume.toLocaleString()} | Trafic: ${k.estimated_traffic} | Tendance: ${k.trend_direction} (${k.monthly_change > 0 ? '+' : ''}${k.monthly_change})`
        ).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `⚖️ **COMPARAISON DE ${result.total_analyzed} MOTS-CLÉS**\n\n` +
                    `📊 **Analyse comparative :**\n${comparison}\n\n` +
                    `🏆 **Meilleur performer :** ${result.best_performer}\n\n` +
                    `💡 **Recommandations :**\n` +
                    result.recommendations.map(r => `• ${r}`).join('\n') + '\n\n' +
                    `📅 **Date d'analyse :** ${new Date(result.comparison_date).toLocaleDateString('fr-FR')}\n` +
                    `🌐 **Site web ID :** ${result.website_id}`
            }
          ]
        };
      }

      case "get_website_performance_summary": {
        const parsed = WebsiteSummaryArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour get_website_performance_summary: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        
        if (!result.has_data) {
          return {
            content: [
              {
                type: "text",
                text: `🌐 **TABLEAU DE BORD SEO - SITE #${result.website_id}**\n\n` +
                      `⚠️ **Aucune donnée disponible**\n\n` +
                      `📊 **Période analysée :** ${result.period_days} jours\n` +
                      `📈 **Mots-clés dans la base :** ${result.overall_metrics.total_keywords}\n\n` +
                      `💡 **Cause possible :** Pas de propriété Google Search Console associée ou données GSC non disponibles pour cette période.`
              }
            ]
          };
        }
        
        const topKeywords = result.top_performing_keywords?.map(k => 
          `• ${k.keyword} (#${k.position}, ${k.clicks} clics)`
        ).join('\n') || 'Aucun mot-clé avec des clics';
        
        // Ajouter les informations de dates si disponibles
        let dateInfo = `📅 **Période analysée :** ${result.period_days} jours`;
        if (parsed.data.start_date && parsed.data.end_date) {
          dateInfo = `📅 **Période analysée :** du ${parsed.data.start_date} au ${parsed.data.end_date} (${result.period_days} jours)`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: `🌐 **TABLEAU DE BORD SEO - SITE #${result.website_id}**\n\n` +
                    `${dateInfo}\n\n` +
                    `📊 **Métriques globales :**\n` +
                    `• Mots-clés suivis : ${result.overall_metrics.total_keywords.toLocaleString()}\n` +
                    `• Total des clics : ${result.overall_metrics.total_clicks.toLocaleString()}\n` +
                    `• Total des impressions : ${result.overall_metrics.total_impressions.toLocaleString()}\n` +
                    `• Position moyenne : ${result.overall_metrics.average_position ? '#' + result.overall_metrics.average_position : 'Non disponible'}\n` +
                    `• CTR moyen : ${result.overall_metrics.average_ctr ? (result.overall_metrics.average_ctr * 100).toFixed(2) + '%' : 'Non disponible'}\n\n` +
                    `📈 **Distribution des positions :**\n` +
                    `• Top 3 : ${result.performance_changes.position_distribution.top3} mots-clés\n` +
                    `• Top 10 : ${result.performance_changes.position_distribution.top10} mots-clés\n` +
                    `• Top 20 : ${result.performance_changes.position_distribution.top20} mots-clés\n` +
                    `• Top 50 : ${result.performance_changes.position_distribution.top50} mots-clés\n` +
                    `• Top 100 : ${result.performance_changes.position_distribution.top100} mots-clés\n\n` +
                    `🏆 **Mots-clés les plus performants :**\n${topKeywords}`
            }
          ]
        };
      }

      case "detect_ranking_changes": {
        const parsed = RankingChangesArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour detect_ranking_changes: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        
        if (!result.has_data) {
          return {
            content: [
              {
                type: "text",
                text: `🔄 **DÉTECTION DE CHANGEMENTS SIGNIFICATIFS**\n\n` +
                      `⚠️ **Aucune donnée disponible**\n\n` +
                      `📊 **Site web ID :** ${result.website_id}\n` +
                      `📅 **Période :** ${result.period_days} jours\n` +
                      `🎯 **Seuil :** ±${result.threshold} positions\n\n` +
                      `💡 **Cause possible :** Pas de propriété Google Search Console associée ou données GSC insuffisantes.`
              }
            ]
          };
        }
        
        const changes = result.significant_changes.map(c => {
          let changeText = '';
          if (c.change_type === 'improvement') {
            changeText = `📈 **${c.keyword}**: #${c.old_position} → #${c.new_position} (${Math.abs(c.change)} positions vers le haut)`;
          } else if (c.change_type === 'drop') {
            changeText = `📉 **${c.keyword}**: #${c.old_position} → #${c.new_position} (+${c.change} positions vers le bas)`;
          } else if (c.change_type === 'new_entry') {
            changeText = `🆕 **${c.keyword}**: Nouveau classement à la position #${c.new_position}`;
          } else if (c.change_type === 'disappeared') {
            changeText = `❌ **${c.keyword}**: A disparu du classement (était à la position #${c.old_position})`;
          }
          
          if (c.clicks > 0 || c.impressions > 0) {
            changeText += ` | ${c.clicks} clics, ${c.impressions} impressions`;
          }
          
          if (c.significance === 'major') {
            changeText = '🚨 ' + changeText + ' **[CHANGEMENT MAJEUR]**';
          }
          
          return changeText;
        }).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🔄 **DÉTECTION DE CHANGEMENTS SIGNIFICATIFS**\n\n` +
                    `🌐 **Site web ID :** ${result.website_id}\n` +
                    `📅 **Période analysée :** ${result.period_days} jours\n` +
                    `🎯 **Seuil de détection :** ±${result.threshold} positions\n\n` +
                    `📊 **Résumé :**\n` +
                    `• Total changements détectés : ${result.summary.changes_detected}\n` +
                    `• 📈 Améliorations : ${result.summary.improvements}\n` +
                    `• 📉 Chutes : ${result.summary.drops}\n` +
                    `• 🚨 Changements majeurs : ${result.summary.major_changes}\n` +
                    `• 🆕 Nouvelles entrées : ${result.summary.new_entries}\n` +
                    `• ❌ Disparitions : ${result.summary.disappeared}\n\n` +
                    (changes ? `📋 **Changements détectés :**\n${changes}` : '✅ **Aucun changement significatif détecté**')
            }
          ]
        };
      }

      case "list_user_websites": {
        const parsed = ListUserWebsitesArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour list_user_websites: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        const websitesList = result.websites.map(w => 
          `• **${w.domain}** (ID: ${w.id})${w.is_favorite ? ' ⭐' : ''}`
        ).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🌐 **VOS SITES WEB REFERENCIME**\n\n` +
                    `👤 **Utilisateur ID :** ${result.user_id}\n` +
                    `📊 **Nombre de sites :** ${result.websites_count}\n\n` +
                    `📋 **Liste des sites :**\n${websitesList}\n\n` +
                    `💡 **Utilisation :** Utilisez l'ID du site dans les autres outils d'analyse SEO.`
            }
          ]
        };
      }

      case "get_keywords_by_categories": {
        const parsed = GetKeywordsByCategoriesArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour get_keywords_by_categories: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        
        if (!result.has_gsc_data) {
          return {
            content: [
              {
                type: "text",
                text: `📂 **MOTS-CLÉS PAR CATÉGORIES - SITE #${result.website_id}**\n\n` +
                      `⚠️ **Données GSC non disponibles**\n\n` +
                      `📊 **Période analysée :** ${result.period_days} jours\n` +
                      `📈 **Total mots-clés :** ${result.summary.total_keywords}\n` +
                      `🗂️ **Catégories :** ${result.summary.total_categories}\n\n` +
                      `💡 **Cause :** Pas de propriété Google Search Console associée au site.\n\n` +
                      `📋 **Structure disponible :**\n` +
                      result.categories.map(cat => 
                        `• **${cat.category_name}**: ${cat.keywords_count} mots-clés`
                      ).join('\n')
              }
            ]
          };
        }
        
        // Formatage des catégories avec performances
        const categoriesText = result.categories.map(category => {
          const categoryHeader = `\n🗂️ **${category.category_name.toUpperCase()}** (${category.keywords_count} mots-clés)\n` +
                               `${'─'.repeat(50)}\n`;
          
          if (category.keywords_count === 0) {
            return categoryHeader + `   • Aucun mot-clé dans cette catégorie\n`;
          }
          
          const keywordsText = category.keywords.slice(0, 10).map(keyword => {
            let keywordLine = `   • **${keyword.keyword}**`;
            
            if (result.include_performance && keyword.performance_metrics) {
              const perf = keyword.performance_metrics;
              if (perf.has_data) {
                keywordLine += ` | Pos: #${perf.position || 'N/A'} | ${perf.clicks} clics | ${perf.impressions} impr`;
                if (perf.ctr > 0) {
                  keywordLine += ` | CTR: ${(perf.ctr * 100).toFixed(1)}%`;
                }
              } else {
                keywordLine += ` | Pas de données GSC`;
              }
            }
            
            if (keyword.search_volume > 0) {
              keywordLine += ` | Vol: ${keyword.search_volume.toLocaleString()}`;
            }
            
            return keywordLine;
          }).join('\n');
          
          const truncatedNote = category.keywords_count > 10 ? 
            `\n   ... et ${category.keywords_count - 10} autres mots-clés` : '';
          
          return categoryHeader + keywordsText + truncatedNote + '\n';
        }).join('');
        
        // Calcul des statistiques globales
        const totalWithPosition = result.categories.flatMap(cat => 
          cat.keywords.filter(k => k.performance_metrics?.position > 0)
        ).length;
        
        const avgPosition = totalWithPosition > 0 ? 
          result.categories.flatMap(cat => 
            cat.keywords.filter(k => k.performance_metrics?.position > 0)
              .map(k => k.performance_metrics.position)
          ).reduce((sum, pos) => sum + pos, 0) / totalWithPosition : null;
        
        return {
          content: [
            {
              type: "text",
              text: `📂 **MOTS-CLÉS PAR CATÉGORIES - SITE #${result.website_id}**\n\n` +
                    `📅 **Période analysée :** ${result.period_days} jours\n` +
                    `📊 **Métriques GSC :** ${result.include_performance ? 'Incluses' : 'Désactivées'}\n\n` +
                    `📈 **Résumé global :**\n` +
                    `• Total mots-clés : ${result.summary.total_keywords.toLocaleString()}\n` +
                    `• Catégories : ${result.summary.total_categories}\n` +
                    `• Non catégorisés : ${result.summary.uncategorized_keywords}\n` +
                    `• Avec position GSC : ${totalWithPosition}\n` +
                    (avgPosition ? `• Position moyenne : #${avgPosition.toFixed(1)}\n` : '') +
                    `\n${categoriesText}\n` +
                    `📅 **Dernière mise à jour :** ${new Date(result.last_updated).toLocaleString('fr-FR')}\n\n` +
                    `💡 **Astuce :** Utilisez ces données pour identifier vos thématiques SEO les plus performantes !`
            }
          ]
        };
      }

      default:
        throw new Error(`Outil inconnu: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Referencime MCP] Erreur: ${errorMessage}`);
    
    return {
      content: [
        {
          type: "text",
          text: `❌ **Erreur**: ${errorMessage}`
        }
      ],
      isError: true,
    };
  }
});

// Lancement du serveur
async function runServer() {
  console.error("[Referencime MCP] 🚀 Démarrage du serveur MCP Referencime...");
  
  // Vérification de la clé API au démarrage
  try {
    getApiKey();
    console.error("[Referencime MCP] ✅ Clé API Referencime détectée");
  } catch (error) {
    console.error("[Referencime MCP] ❌ REFERENCIME_API_KEY manquant !");
    console.error("[Referencime MCP] 💡 Ajoutez votre clé API dans la configuration Claude Desktop :");
    console.error('[Referencime MCP]    "env": { "REFERENCIME_API_KEY": "votre_cle_api" }');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("[Referencime MCP] ✅ Serveur MCP Referencime prêt pour Claude Desktop");
  console.error("[Referencime MCP] 🛠️  7 outils d'analyse SEO disponibles");
  console.error("[Referencime MCP] 🔗 Connecté aux vraies APIs WordPress Referencime");
}

// Point d'entrée
if (process.argv.length > 2 && process.argv[2] === 'start') {
  runServer().catch((error) => {
    console.error("[Referencime MCP] ❌ Erreur fatale:", error);
    process.exit(1);
  });
} else {
  console.log('Usage: referencime-mcp start');
  console.log('');
  console.log('Configuration Claude Desktop:');
  console.log(JSON.stringify({
    "mcpServers": {
      "referencime": {
        "command": "npx",
        "args": ["-y", "@referencime/mcp-server", "start"],
        "env": {
          "REFERENCIME_API_KEY": "votre_cle_api_ici"
        }
      }
    }
  }, null, 2));
}
