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
 * Referencime MCP Server - Version refactorisée
 * Compatible avec Claude Desktop
 * Architecture simplifiée avec 5 endpoints essentiels
 */

// Schema definitions pour nos outils SEO
const ListWebsitesByUserArgsSchema = z.object({
  // Aucun paramètre requis - utilise la clé API pour identifier l'utilisateur
});

const ListCategoriesByWebsiteArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime')
});

const ListKeywordsByWebsiteArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  include_metrics: z.boolean().optional().default(false).describe('Inclure les volumes de recherche Google Ads')
});

const ListKeywordsByCategoriesByWebsiteArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  include_performance: z.boolean().optional().default(true).describe('Inclure les métriques de performance GSC'),
  days: z.number().optional().default(30).describe('Période pour les métriques GSC (en jours)')
});

const WebsiteSummaryArgsSchema = z.object({
  website_id: z.number().describe('ID du site web dans Referencime'),
  period: z.string().optional().default('30days').describe('Période d\'analyse (7days, 30days, 90days)'),
  start_date: z.string().optional().describe('Date de début au format YYYY-MM-DD'),
  end_date: z.string().optional().describe('Date de fin au format YYYY-MM-DD'),
  compare_start_date: z.string().optional().describe('Date de début de comparaison au format YYYY-MM-DD'),
  compare_end_date: z.string().optional().describe('Date de fin de comparaison au format YYYY-MM-DD')
});

// Configuration du serveur
const server = new Server(
  {
    name: "referencime-mcp-server",
    version: "2.0.0",
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
      case 'list_websites_by_user':
        endpoint = '/ai/list-websites-by-user';
        break;
      case 'list_categories_by_website':
        endpoint = '/ai/list-categories-by-website';
        break;
      case 'list_keywords_by_website':
        endpoint = '/ai/list-keywords-by-website';
        break;
      case 'list_keywords_by_categories_by_website':
        endpoint = '/ai/list-keywords-by-categories-by-website';
        break;
      case 'get_website_performance_summary':
        endpoint = '/ai/get-website-performance-summary';
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
        name: "list_websites_by_user",
        description: "Liste tous les sites web auxquels l'utilisateur a accès dans son compte Referencime avec leurs IDs, noms de domaine et dates de création.",
        inputSchema: zodToJsonSchema(ListWebsitesByUserArgsSchema),
      },
      {
        name: "list_categories_by_website",
        description: "Liste toutes les catégories de mots-clés d'un site web avec le nombre de mots-clés dans chaque catégorie pour une organisation thématique SEO.",
        inputSchema: zodToJsonSchema(ListCategoriesByWebsiteArgsSchema),
      },
      {
        name: "list_keywords_by_website",
        description: "Liste tous les mots-clés suivis pour un site web avec leur catégorie et optionnellement leurs volumes de recherche Google Ads.",
        inputSchema: zodToJsonSchema(ListKeywordsByWebsiteArgsSchema),
      },
      {
        name: "list_keywords_by_categories_by_website",
        description: "Récupère tous les mots-clés d'un site web organisés par catégories avec métriques de performance GSC (positions, clics, impressions, CTR) et analyse thématique SEO complète.",
        inputSchema: zodToJsonSchema(ListKeywordsByCategoriesByWebsiteArgsSchema),
      },
      {
        name: "get_website_performance_summary",
        description: "Tableau de bord complet des performances SEO d'un site web : métriques globales GSC, distribution des positions et mots-clés les plus performants.",
        inputSchema: zodToJsonSchema(WebsiteSummaryArgsSchema),
      },
    ],
  };
});

// Handler pour exécuter les outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "list_websites_by_user": {
        const parsed = ListWebsitesByUserArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour list_websites_by_user: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        const websitesList = result.websites.map(w => 
          `• **${w.domain}** (ID: ${w.id})${w.is_favorite ? ' ⭐' : ''} - Créé le ${new Date(w.created_date).toLocaleDateString('fr-FR')}`
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

      case "list_categories_by_website": {
        const parsed = ListCategoriesByWebsiteArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour list_categories_by_website: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        const categoriesList = result.categories.map(c => 
          `• **${c.name}** (${c.keywords_count} mots-clés)`
        ).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🗂️ **CATÉGORIES DE MOTS-CLÉS - SITE #${result.website_id}**\n\n` +
                    `📊 **Nombre de catégories :** ${result.categories_count}\n\n` +
                    `📋 **Liste des catégories :**\n${categoriesList}\n\n` +
                    `💡 **Organisation :** Catégorisez vos mots-clés par thème pour une meilleure stratégie SEO.`
            }
          ]
        };
      }

      case "list_keywords_by_website": {
        const parsed = ListKeywordsByWebsiteArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour list_keywords_by_website: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        
        // Grouper par catégorie pour un affichage organisé
        const byCategory = {};
        result.keywords.forEach(k => {
          const catName = k.category_name || 'Non catégorisé';
          if (!byCategory[catName]) byCategory[catName] = [];
          byCategory[catName].push(k);
        });
        
        const keywordsList = Object.entries(byCategory).map(([catName, keywords]) => {
          const keywordsText = keywords.slice(0, 20).map(k => {
            let line = `   • ${k.keyword}`;
            if (result.include_metrics && k.search_volume) {
              line += ` (Vol: ${k.search_volume.toLocaleString()})`;
            }
            return line;
          }).join('\n');
          
          const truncated = keywords.length > 20 ? `\n   ... et ${keywords.length - 20} autres mots-clés` : '';
          return `\n**${catName}** (${keywords.length} mots-clés):\n${keywordsText}${truncated}`;
        }).join('\n');
        
        return {
          content: [
            {
              type: "text",
              text: `🔤 **MOTS-CLÉS - SITE #${result.website_id}**\n\n` +
                    `📊 **Total mots-clés :** ${result.keywords_count}\n` +
                    `📈 **Volumes de recherche :** ${result.include_metrics ? 'Inclus' : 'Non inclus'}\n` +
                    `${keywordsList}\n\n` +
                    `💡 **Astuce :** Utilisez list_keywords_by_categories_by_website pour des métriques de performance détaillées.`
            }
          ]
        };
      }

      case "list_keywords_by_categories_by_website": {
        const parsed = ListKeywordsByCategoriesByWebsiteArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Arguments invalides pour list_keywords_by_categories_by_website: ${parsed.error.message}`);
        }
        
        const result = await callReferencimeAPI(name, parsed.data);
        
        if (!result.has_gsc_data) {
          return {
            content: [
              {
                type: "text",
                text: `📂 **MOTS-CLÉS PAR CATÉGORIES - SITE #${result.website_id}**\n\n` +
                      `⚠️ **Données GSC non disponibles**\n\n` +
                      `📊 **Période :** ${result.period_days} jours\n` +
                      `📈 **Total mots-clés :** ${result.summary.total_keywords}\n` +
                      `🗂️ **Catégories :** ${result.summary.total_categories}\n\n` +
                      `💡 **Cause :** Pas de propriété Google Search Console associée.\n\n` +
                      `📋 **Structure :**\n` +
                      result.categories.map(cat => 
                        `• **${cat.category_name}**: ${cat.keywords_count} mots-clés`
                      ).join('\n')
              }
            ]
          };
        }
        
        // Formatage des catégories avec performances
        const categoriesText = result.categories.map(category => {
          const categoryHeader = `\n🗂️ **${(category.category_name || 'Sans nom').toUpperCase()}** (${category.keywords_count} mots-clés)\n` +
                               `${'─'.repeat(50)}\n`;
          
          if (category.keywords_count === 0) {
            return categoryHeader + `   • Aucun mot-clé\n`;
          }
          
          const keywordsText = category.keywords.slice(0, 10).map(keyword => {
            let line = `   • **${keyword.keyword}**`;
            
            if (result.include_performance && keyword.performance_metrics) {
              const perf = keyword.performance_metrics;
              if (perf.has_data) {
                line += ` | #${perf.position || 'N/A'} | ${perf.clicks} clics | ${perf.impressions} impr`;
                if (perf.ctr > 0) line += ` | CTR: ${(perf.ctr * 100).toFixed(1)}%`;
              } else {
                line += ` | Pas de données GSC`;
              }
            }
            
            if (keyword.search_volume > 0) {
              line += ` | Vol: ${keyword.search_volume.toLocaleString()}`;
            }
            
            return line;
          }).join('\n');
          
          const truncated = category.keywords_count > 10 ? 
            `\n   ... et ${category.keywords_count - 10} autres` : '';
          
          return categoryHeader + keywordsText + truncated + '\n';
        }).join('');
        
        // Statistiques globales
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
                    `📅 **Période :** ${result.period_days} jours\n` +
                    `📊 **Métriques GSC :** ${result.include_performance ? 'Incluses' : 'Désactivées'}\n\n` +
                    `📈 **Résumé :**\n` +
                    `• Total mots-clés : ${result.summary.total_keywords.toLocaleString()}\n` +
                    `• Catégories : ${result.summary.total_categories}\n` +
                    `• Non catégorisés : ${result.summary.uncategorized_keywords}\n` +
                    `• Avec position GSC : ${totalWithPosition}\n` +
                    (avgPosition ? `• Position moyenne : #${avgPosition.toFixed(1)}\n` : '') +
                    `\n${categoriesText}\n` +
                    `📅 **MAJ :** ${new Date(result.last_updated).toLocaleString('fr-FR')}\n\n` +
                    `💡 **Astuce :** Identifiez vos thématiques SEO les plus performantes !`
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
                      `📊 **Période :** ${result.period_days || result.period?.days || 'N/A'} jours\n` +
                      `📈 **Mots-clés :** ${result.overall_metrics.total_keywords}\n\n` +
                      `💡 **Cause :** Pas de propriété GSC ou données non disponibles.`
              }
            ]
          };
        }
        
        const topKeywords = result.top_performing_keywords?.map(k => 
          `• ${k.keyword} (#${k.position.toFixed(1)}, ${k.clicks} clics)`
        ).join('\n') || 'Aucun';
        
        // Formatage des périodes (nouveau format API)
        let dateInfo = '';
        if (result.period) {
          dateInfo = `📅 **Période :** du ${result.period.start_date} au ${result.period.end_date} (${result.period.days} jours)`;
          if (result.compare_period) {
            dateInfo += `\n📅 **Comparaison :** du ${result.compare_period.start_date} au ${result.compare_period.end_date}`;
          }
        } else {
          // Fallback ancien format
          dateInfo = `📅 **Période :** ${result.period_days} jours`;
        }
        
        // Formatage des catégories si présentes
        let categoriesSection = '';
        if (result.categories && result.categories.length > 0) {
          categoriesSection = '\n\n📂 **PERFORMANCES PAR CATÉGORIE :**\n\n';
          result.categories.forEach((cat, index) => {
            categoriesSection += `**${index + 1}. ${cat.category_name}** (${cat.keywords_count} mots-clés)\n`;
            categoriesSection += `   • Position moyenne : ${cat.metrics.position.current ? '#' + cat.metrics.position.current : 'N/A'}`;
            if (cat.metrics.position.compare && cat.metrics.position.evolution) {
              const evol = cat.metrics.position.evolution;
              const evolutionText = evol > 0 ? `📈 +${evol}` : evol < 0 ? `📉 ${evol}` : '➡️ =';
              categoriesSection += ` (${evolutionText} vs période précédente)`;
            }
            categoriesSection += `\n   • Clics : ${cat.metrics.clicks.current}`;
            if (cat.metrics.clicks.evolution_percent !== null) {
              const evol = cat.metrics.clicks.evolution_percent;
              const sign = evol >= 0 ? '+' : '';
              categoriesSection += ` (${sign}${evol.toFixed(1)}%)`;
            }
            categoriesSection += `\n   • Impressions : ${cat.metrics.impressions.current.toLocaleString()}`;
            if (cat.metrics.impressions.evolution_percent !== null) {
              const evol = cat.metrics.impressions.evolution_percent;
              const sign = evol >= 0 ? '+' : '';
              categoriesSection += ` (${sign}${evol.toFixed(1)}%)`;
            }
            if (cat.top_keywords && cat.top_keywords.length > 0) {
              categoriesSection += `\n   🏆 Top mots-clés : ${cat.top_keywords.slice(0, 3).map(k => k.keyword).join(', ')}`;
            }
            categoriesSection += '\n\n';
          });
        }
        
        // Formater les métriques avec évolutions (calculées par le backend)
        const formatMetric = (metric) => {
          if (typeof metric === 'number') return metric.toLocaleString();
          if (typeof metric === 'object' && metric.current !== undefined) {
            let text = metric.current.toLocaleString();
            if (metric.evolution_text) {
              text += ` (${metric.evolution_text})`;
            }
            return text;
          }
          return metric;
        };
        
        return {
          content: [
            {
              type: "text",
              text: `🌐 **TABLEAU DE BORD SEO - SITE #${result.website_id}**\n\n` +
                    `${dateInfo}\n\n` +
                    `📊 **Métriques globales :**\n` +
                    `• Mots-clés suivis : ${result.overall_metrics.total_keywords}\n` +
                    `• Total clics : ${formatMetric(result.overall_metrics.total_clicks)}\n` +
                    `• Total impressions : ${formatMetric(result.overall_metrics.total_impressions)}\n` +
                    `• Position moyenne : ${result.overall_metrics.average_position ? (typeof result.overall_metrics.average_position === 'object' ? '#' + result.overall_metrics.average_position.current + (result.overall_metrics.average_position.evolution_text ? ' (' + result.overall_metrics.average_position.evolution_text + ')' : '') : '#' + result.overall_metrics.average_position) : 'N/A'}\n` +
                    `• CTR moyen : ${result.overall_metrics.average_ctr ? (typeof result.overall_metrics.average_ctr === 'object' ? (result.overall_metrics.average_ctr.current * 100).toFixed(2) + '%' + (result.overall_metrics.average_ctr.evolution_text ? ' (' + result.overall_metrics.average_ctr.evolution_text + ')' : '') : (result.overall_metrics.average_ctr * 100).toFixed(2) + '%') : 'N/A'}\n\n` +
                    `📈 **Distribution des positions :**\n` +
                    `• Top 3 : ${result.performance_changes.position_distribution.top3} mots-clés\n` +
                    `• Top 10 : ${result.performance_changes.position_distribution.top10} mots-clés\n` +
                    `• Top 20 : ${result.performance_changes.position_distribution.top20} mots-clés\n` +
                    `• Top 50 : ${result.performance_changes.position_distribution.top50} mots-clés\n` +
                    `• Top 100 : ${result.performance_changes.position_distribution.top100} mots-clés\n\n` +
                    `🏆 **Top performeurs :**\n${topKeywords}` +
                    categoriesSection
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
  console.error("[Referencime MCP] 🚀 Démarrage du serveur MCP Referencime v2.0...");
  
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
  
  console.error("[Referencime MCP] ✅ Serveur MCP Referencime prêt");
  console.error("[Referencime MCP] 🛠️  5 outils d'analyse SEO disponibles (architecture refactorisée)");
  console.error("[Referencime MCP] 🔗 Connecté aux APIs WordPress Referencime");
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
