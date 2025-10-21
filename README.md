# 🚀 Referencime MCP Server pour Claude Desktop

Intégrez vos données SEO Referencime directement dans Claude Desktop grâce au Model Context Protocol (MCP).

## 📋 Prérequis

- [Claude Desktop](https://claude.ai/download) avec un abonnement Pro ou Maximum
- [Node.js](https://nodejs.org/) version 18 ou supérieure
- Une clé API Referencime (disponible dans votre compte Easy Links)

## ⚡ Installation rapide (2 étapes)

### Étape 1 : Configuration Claude Desktop

1. Ouvrez Claude Desktop
2. Allez dans **Paramètres... → Développeur → Modifier la configuration**
3. Ajoutez cette configuration dans le fichier `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "referencime": {
      "command": "npx",
      "args": [
        "-y",
        "@referencime/mcp-server@1.0.7",
        "start"
      ],
      "env": {
        "REFERENCIME_API_KEY": "VOTRE_CLE_API_ICI"
      }
    }
  }
}
```

### Étape 2 : Ajoutez votre clé API

1. Remplacez `VOTRE_CLE_API_ICI` par votre vraie clé API Referencime
2. Sauvegardez le fichier
3. **Redémarrez** Claude Desktop (fermer complètement et rouvrir)

**C'est tout !** 🎉

## 🔑 Où trouver votre clé API ?

Connectez-vous à votre compte Easy Links sur [referencime.fr](https://referencime.fr) et allez dans la section API de votre profil.

## 🛠️ Outils disponibles

Une fois configuré, vous pouvez utiliser ces commandes dans Claude Desktop :

### 📊 Analyse de mot-clé
```
Peux-tu analyser les performances du mot-clé "référencement naturel" pour le site web ID 1 ?
```

### 📈 Évolution des positions
```
Montre-moi l'évolution des positions du mot-clé "SEO" sur les 30 derniers jours pour le site 1
```

### ⚖️ Comparaison de mots-clés
```
Compare les performances des mots-clés "SEO", "référencement", "optimisation" pour le site 1
```

### 🌐 Résumé performance site
```
Donne-moi un résumé des performances SEO globales du site web ID 1 sur le mois dernier
```

### 🔄 Détection de changements
```
Détecte les changements significatifs de positions pour le site 1 cette semaine
```

## 🔧 Dépannage

### ❌ Erreur "spawn npx ENOENT"
- **Solution** : Installez [Node.js](https://nodejs.org/) puis redémarrez Claude Desktop

### ❌ Erreur "REFERENCIME_API_KEY non configuré"
- **Solution** : Vérifiez que votre clé API est correctement ajoutée dans la configuration

### ❌ Outils non disponibles
- **Solution** : Redémarrez complètement Claude Desktop (ne pas juste minimiser)

### ✅ Test de fonctionnement
Demandez à Claude : *"Peux-tu lister les outils Referencime disponibles ?"*

## 📍 Emplacements du fichier de configuration

- **Windows** : `%APPDATA%/Claude/claude_desktop_config.json`  
- **macOS** : `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux** : `~/.config/claude/claude_desktop_config.json`

## 🏗️ Architecture technique

Ce package NPM agit comme un pont entre Claude Desktop et le serveur centralisé Referencime :

```
Claude Desktop → @referencime/mcp-server → mcp.referencime.fr → Base de données SEO
```

- **Client local** : Ce package NPM s'exécute sur votre machine
- **Serveur centralisé** : Hébergé sur `mcp.referencime.fr`
- **Authentification** : Via votre clé API Referencime
- **Sécurité** : Connexion chiffrée WebSocket (wss://)

## 📞 Support

- **Documentation** : [referencime.fr/docs](https://referencime.fr)
- **Support** : contact@referencime.fr
- **Issues** : GitHub Issues de ce repository

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

---

**Développé avec ❤️ par l'équipe Referencime**
