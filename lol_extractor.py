"""
League of Legends Account Data Extractor
Uses the LCU (League Client Update) API to extract account data
when the League Client is running and logged in.
"""

import os
import json
import base64
import urllib3
import re
from datetime import datetime

# Disable SSL warnings for local API
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# =====================
# RARE SKINS LISTS
# =====================
HIGH_PRIORITY_SKINS = [
    "PAX Jax",
    "PAX Twisted Fate", 
    "PAX Sivir",
    "Black Alistar",
    "Human Ryze",  # Also known as Young Ryze
    "Young Ryze",
    "Silver Kayle",
    "Immortalized Legend Ahri",
    "Risen Legend Ahri",
    "Immortalized Legend Kai'Sa",
    "Risen Legend Kai'Sa",
    "Risen Legend LeBlanc",
    "Risen Legend Vayne",
    "Championship Riven",  # 2012 - exclude if has "Reignited"
    "Victorious Jarvan IV",
    "Rusty Blitzcrank",
    "Arcane Fractured Jinx",
    "Spirit Blossom Morgana",
    "Sahn-Uzal Mordekaiser",
    "Radiant Serpent Sett",
    "Revenant Reign Viego",
    "Genesis Nightbringer Yasuo",
    "After Hours Spirit Blossom Springs Ahri",
    "Breakout True Damage Ekko",
    "Dark Cosmic Erasure Jhin",
]

MEDIUM_PRIORITY_SKINS = [
    "Victorious Janna",
    "Victorious Elise",
    "King Rammus",
    "UFO Corki",
    "Judgement Kayle",
]

# Priority wards (Riot or Fist Bump)
PRIORITY_WARD_KEYWORDS = ["riot", "fist bump"]

# Region mapping
REGION_MAP = {
    "NA": "NA",
    "NA1": "NA",
    "EUW": "EUW",
    "EUW1": "EUW",
    "EUNE": "EUNE",
    "EUN1": "EUNE",
    "KR": "KR",
    "BR": "BR",
    "BR1": "BR",
    "LAN": "LAN",
    "LA1": "LAN",
    "LAS": "LAS",
    "LA2": "LAS",
    "OCE": "OCE",
    "OC1": "OCE",
    "RU": "RU",
    "TR": "TR",
    "TR1": "TR",
    "JP": "JP",
    "JP1": "JP",
    "PH": "SG2",
    "PH2": "SG2",
    "SG": "SG2",
    "SG2": "SG2",
    "TW": "TW",
    "TW2": "TW",
    "TH": "SG2",
    "TH2": "SG2",
    "VN": "VN",
    "VN2": "VN",
}


class LoLExtractor:
    """Extracts account data from running League Client"""
    
    def __init__(self, league_path=None):
        # Default League installation path
        if league_path is None:
            league_path = r"C:\Riot Games\League of Legends"
        
        self.league_path = league_path
        self.lockfile_path = os.path.join(league_path, "lockfile")
        
        self.port = None
        self.password = None
        self.protocol = "https"
        self.session = None
        
        # Cache for all skins data
        self.all_skins_data = {}
        self.all_icons_data = {}
        self.all_wards_data = {}
    
    def is_client_running(self):
        """Check if League Client is running by looking for lockfile"""
        return os.path.exists(self.lockfile_path)
    
    def connect(self):
        """Connect to the LCU API"""
        if not self.is_client_running():
            raise Exception("League Client is not running. Please open and login to League of Legends first.")
        
        # Read lockfile
        try:
            with open(self.lockfile_path, 'r') as f:
                lockfile_content = f.read()
        except PermissionError:
            raise Exception("Cannot read lockfile. Make sure League Client is fully loaded.")
        
        # Parse lockfile: name:pid:port:password:protocol
        parts = lockfile_content.split(':')
        if len(parts) < 5:
            raise Exception("Invalid lockfile format")
        
        self.port = parts[2]
        self.password = parts[3]
        self.protocol = parts[4]
        
        # Create session with auth
        self.session = urllib3.HTTPSConnectionPool(
            '127.0.0.1',
            port=int(self.port),
            headers={
                'Authorization': f'Basic {base64.b64encode(f"riot:{self.password}".encode()).decode()}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            cert_reqs='CERT_NONE'
        )
        
        # Test connection
        try:
            response = self.session.request('GET', '/lol-summoner/v1/current-summoner')
            if response.status != 200:
                raise Exception(f"Connection test failed: {response.status}")
        except Exception as e:
            raise Exception(f"Failed to connect to League Client: {e}")
        
        return True
    
    def _request(self, method, endpoint):
        """Make a request to the LCU API"""
        if not self.session:
            raise Exception("Not connected. Call connect() first.")
        
        try:
            response = self.session.request(method, endpoint)
            if response.status == 200:
                return json.loads(response.data.decode('utf-8'))
            elif response.status == 404:
                return None
            else:
                return None
        except Exception as e:
            print(f"[LoL] Request error for {endpoint}: {e}")
            return None
    
    def _save_debug(self, folder, filename, data):
        """Save debug data to file"""
        filepath = os.path.join(folder, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            if isinstance(data, str):
                f.write(data)
            elif data is None:
                f.write("null (no data returned)")
            else:
                json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _parse_purchase_date(self, date_str):
        """Parse purchase date from format 20240802T182034.000Z"""
        if not date_str:
            return None
        try:
            # Format: 20240802T182034.000Z
            date_part = date_str.split('T')[0]
            year = int(date_part[:4])
            month = int(date_part[4:6])
            day = int(date_part[6:8])
            return datetime(year, month, day)
        except:
            return None
    
    def _is_chroma(self, skin_name):
        """
        Check if a skin is a chroma:
        1. Name starts with "Skin #" (no name found)
        2. Name contains parentheses BUT NOT if it's a year (2010-2030)
        """
        if skin_name.startswith("Skin #"):
            return True
        
        if "(" in skin_name and ")" in skin_name:
            # Extract what's inside parentheses
            start = skin_name.find("(")
            end = skin_name.find(")")
            content = skin_name[start+1:end].strip()
            
            # If it's a year (like 2022), it's NOT a chroma (it's a Prestige skin)
            if content.isdigit() and 2010 <= int(content) <= 2030:
                return False
            
            # Otherwise it's a chroma like "Grey Warwick (Meteorite)"
            return True
        
        return False
    
    def _check_rare_skin(self, skin_name):
        """
        Check if a skin is rare and return its priority level.
        Returns: 'high', 'medium', or None
        """
        skin_lower = skin_name.lower()
        
        # Special case: Championship Riven - exclude if "Reignited"
        if "championship riven" in skin_lower and "reignited" in skin_lower:
            return None
        
        # Check high priority
        for rare in HIGH_PRIORITY_SKINS:
            if rare.lower() in skin_lower:
                return 'high'
        
        # Check medium priority
        for rare in MEDIUM_PRIORITY_SKINS:
            if rare.lower() in skin_lower:
                return 'medium'
        
        return None
    
    def _check_priority_ward(self, ward_name):
        """Check if a ward is a priority ward (Riot or Fist Bump)"""
        ward_lower = ward_name.lower()
        for keyword in PRIORITY_WARD_KEYWORDS:
            if keyword in ward_lower:
                return True
        return False
    
    def _format_region(self, region):
        """Format region to standard format"""
        region_upper = region.upper() if region else "Unknown"
        formatted = REGION_MAP.get(region_upper, region_upper)
        # Convert SG2 to SEA for display
        if formatted == "SG2":
            return "SEA"
        return formatted
    
    def _load_all_skins_data(self, progress_callback=None):
        """Load all skins data from game assets"""
        if progress_callback:
            progress_callback("Loading skin database...")
        
        all_skins = self._request('GET', '/lol-game-data/assets/v1/skins.json')
        
        if all_skins and isinstance(all_skins, dict):
            self.all_skins_data = all_skins
            return True
        
        return False
    
    def _load_all_icons_data(self, progress_callback=None):
        """Load all icons data"""
        if progress_callback:
            progress_callback("Loading icon database...")
        
        all_icons = self._request('GET', '/lol-game-data/assets/v1/summoner-icons.json')
        
        if all_icons and isinstance(all_icons, list):
            self.all_icons_data = {icon.get('id'): icon for icon in all_icons}
            return True
        
        return False
    
    def _load_all_wards_data(self, progress_callback=None):
        """Load all ward skins data"""
        if progress_callback:
            progress_callback("Loading ward database...")
        
        all_wards = self._request('GET', '/lol-game-data/assets/v1/ward-skins.json')
        
        if all_wards and isinstance(all_wards, list):
            self.all_wards_data = {ward.get('id'): ward for ward in all_wards}
            return True
        
        return False
    
    def _get_skin_name(self, skin_id):
        """Get skin name from ID using cached data"""
        skin_id_str = str(skin_id)
        
        if skin_id_str in self.all_skins_data:
            skin = self.all_skins_data[skin_id_str]
            if isinstance(skin, dict):
                return skin.get('name', f"Skin #{skin_id}")
        
        if skin_id in self.all_skins_data:
            skin = self.all_skins_data[skin_id]
            if isinstance(skin, dict):
                return skin.get('name', f"Skin #{skin_id}")
        
        return f"Skin #{skin_id}"
    
    def _get_icon_name(self, icon_id):
        """Get icon name from ID"""
        if icon_id in self.all_icons_data:
            icon = self.all_icons_data[icon_id]
            return icon.get('title', '') or icon.get('name', '') or f"Icon #{icon_id}"
        return f"Icon #{icon_id}"
    
    def _get_ward_name(self, ward_id):
        """Get ward name from ID"""
        if ward_id in self.all_wards_data:
            ward = self.all_wards_data[ward_id]
            return ward.get('name', f"Ward #{ward_id}")
        return f"Ward #{ward_id}"
    
    def _generate_title(self, data):
        """Generate account title in format:
        [Server] Level X | X Skins | X Chromas | Rare Skins or 'Comes with OGI'
        """
        region = self._format_region(data.get('region', 'Unknown'))
        level = data.get('level', 0)
        skins_count = data.get('skins_count', 0)
        chromas_count = data.get('chromas_count', 0)
        
        # Get priority items (high priority skins + wards first)
        rare_high = data.get('rare_skins_high', [])
        rare_medium = data.get('rare_skins_medium', [])
        priority_wards = data.get('priority_wards', [])
        
        # Build priority list - wards take top priority, then high, then medium
        priority_items = []
        
        # Add up to 3 items total
        # First add high priority skins
        for skin in rare_high[:2]:
            priority_items.append(skin)
        
        # Add a priority ward if available (always include)
        if priority_wards:
            priority_items.append(priority_wards[0])
        
        # If we have less than 3 items, add more high priority
        if len(priority_items) < 3 and len(rare_high) > 2:
            for skin in rare_high[2:]:
                if len(priority_items) >= 3:
                    break
                if skin not in priority_items:
                    priority_items.append(skin)
        
        # If still less than 3, add medium priority
        if len(priority_items) < 3:
            for skin in rare_medium:
                if len(priority_items) >= 3:
                    break
                if skin not in priority_items:
                    priority_items.append(skin)
        
        # Build the title
        base = f"[{region}] Level {level} | {skins_count} Skins | {chromas_count} Chromas"
        
        if priority_items:
            # Check if there are more items
            total_rare = len(rare_high) + len(rare_medium) + len(priority_wards)
            if total_rare > 3:
                suffix = " + " + " + ".join(priority_items) + " + more"
            else:
                suffix = " + " + " + ".join(priority_items)
            return base + " |" + suffix
        else:
            return base + " | Comes with OGI"
    
    def _generate_description(self, data):
        """Generate account description"""
        region = self._format_region(data.get('region', 'Unknown'))
        level = data.get('level', 0)
        rank = data.get('rank', 'Unranked')
        skins_count = data.get('skins_count', 0)
        icons_count = data.get('icons_count', 0)
        chromas_count = data.get('chromas_count', 0)
        wards_count = data.get('wards_count', 0)
        be = data.get('blue_essence', 0)
        rp = data.get('rp', 0)
        account_year = data.get('account_created_est', 'Unknown')
        
        # Get all rare skins
        rare_high = data.get('rare_skins_high', [])
        rare_medium = data.get('rare_skins_medium', [])
        priority_wards = data.get('priority_wards', [])
        
        # Build rare skins string
        all_rare = rare_high + rare_medium + priority_wards
        rare_str = " + ".join(all_rare) if all_rare else "None"
        
        description = f"""Account Details ({account_year} Account)
Server: {region} (Server Transferrable)
Rank: {rank}
Total Skins: {skins_count}
Total Icons: {icons_count}
Total Chromas: {chromas_count}
Total Wards: {wards_count}
Rare Skins: {rare_str}
Currencies: {rp:,} RP | {be:,} BE
Comes with Original Information"""
        
        return description
    
    def extract_all(self, progress_callback=None):
        """Extract all account data and save debug files"""
        result = {
            'success': False,
            'error': None,
            'data': {}
        }
        
        # Create debug folder for raw API responses
        debug_folder = os.path.join("data", "api_debug", datetime.now().strftime("%Y%m%d_%H%M%S"))
        os.makedirs(debug_folder, exist_ok=True)
        
        try:
            if progress_callback:
                progress_callback("Connecting to League Client...")
            
            self.connect()
            
            # =====================
            # LOAD GAME DATA FIRST
            # =====================
            self._load_all_skins_data(progress_callback)
            self._save_debug(debug_folder, "00_all_skins_data.json", self.all_skins_data)
            
            self._load_all_icons_data(progress_callback)
            self._save_debug(debug_folder, "00_all_icons_data.json", self.all_icons_data)
            
            self._load_all_wards_data(progress_callback)
            self._save_debug(debug_folder, "00_all_wards_data.json", self.all_wards_data)
            
            # =====================
            # 1. SUMMONER INFO
            # =====================
            if progress_callback:
                progress_callback("Getting summoner info...")
            
            summoner_raw = self._request('GET', '/lol-summoner/v1/current-summoner')
            self._save_debug(debug_folder, "01_summoner.json", summoner_raw)
            
            if not summoner_raw:
                raise Exception("Failed to get summoner info")
            
            result['data']['username'] = summoner_raw.get('displayName', '')
            result['data']['level'] = summoner_raw.get('summonerLevel', 0)
            result['data']['riot_id'] = f"{summoner_raw.get('gameName', '')}#{summoner_raw.get('tagLine', '')}"
            
            # =====================
            # 2. REGION
            # =====================
            if progress_callback:
                progress_callback("Getting region...")
            
            region_raw = self._request('GET', '/riotclient/region-locale')
            self._save_debug(debug_folder, "02_region.json", region_raw)
            result['data']['region'] = region_raw.get('region', 'Unknown') if region_raw else 'Unknown'
            
            # =====================
            # 3. WALLET (BE/RP)
            # =====================
            if progress_callback:
                progress_callback("Getting wallet (BE/RP)...")
            
            be_value = 0
            rp_value = 0
            
            wallet1 = self._request('GET', '/lol-store/v1/wallet')
            self._save_debug(debug_folder, "03a_store_wallet.json", wallet1)
            if wallet1:
                be_value = wallet1.get('ip', 0) or be_value
                rp_value = wallet1.get('rp', 0) or rp_value
            
            wallet2 = self._request('GET', '/lol-inventory/v1/wallet')
            self._save_debug(debug_folder, "03b_inventory_wallet.json", wallet2)
            if wallet2 and not be_value:
                be_value = wallet2.get('ip', 0) or be_value
                rp_value = wallet2.get('rp', 0) or rp_value
            
            loot = self._request('GET', '/lol-loot/v1/player-loot')
            self._save_debug(debug_folder, "03c_player_loot.json", loot)
            if loot and isinstance(loot, list):
                for item in loot:
                    loot_id = item.get('lootId', '')
                    if loot_id == 'CURRENCY_champion':
                        be_value = item.get('count', 0) or be_value
                    elif loot_id == 'CURRENCY_RP':
                        rp_value = item.get('count', 0) or rp_value
            
            result['data']['blue_essence'] = be_value
            result['data']['rp'] = rp_value
            
            # =====================
            # 4. RANKED STATS
            # =====================
            if progress_callback:
                progress_callback("Getting ranked stats...")
            
            ranked_raw = self._request('GET', '/lol-ranked/v1/current-ranked-stats')
            self._save_debug(debug_folder, "04_ranked.json", ranked_raw)
            
            rank = "Unranked"
            if ranked_raw:
                queues = ranked_raw.get('queues', [])
                for queue in queues:
                    if queue.get('queueType') == 'RANKED_SOLO_5x5':
                        tier = queue.get('tier', '')
                        division = queue.get('division', '')
                        lp = queue.get('leaguePoints', 0)
                        if tier:
                            rank = f"{tier.capitalize()} {division} ({lp} LP)"
                        break
            result['data']['rank'] = rank
            
            # =====================
            # 5. CHAMPIONS
            # =====================
            if progress_callback:
                progress_callback("Getting champions owned...")
            
            champions_raw = self._request('GET', '/lol-champions/v1/owned-champions-minimal')
            self._save_debug(debug_folder, "05_champions_owned.json", champions_raw)
            result['data']['champions_count'] = len(champions_raw) if champions_raw else 0
            
            # =====================
            # 6. SKINS - Separate skins from chromas, find rare skins
            # =====================
            if progress_callback:
                progress_callback("Getting owned skins...")
            
            skins_inventory = self._request('GET', '/lol-inventory/v2/inventory/CHAMPION_SKIN')
            self._save_debug(debug_folder, "06_skins_inventory.json", skins_inventory)
            
            oldest_date = None
            skins_list = []
            chromas_list = []
            rare_skins_high = []
            rare_skins_medium = []
            
            if skins_inventory:
                for item in skins_inventory:
                    item_id = item.get('itemId', 0)
                    purchase_date_str = item.get('purchaseDate', '')
                    purchase_date = self._parse_purchase_date(purchase_date_str)
                    
                    # Get skin name
                    skin_name = self._get_skin_name(item_id)
                    
                    # Check if it's a chroma
                    if self._is_chroma(skin_name):
                        chromas_list.append(skin_name)
                    else:
                        skins_list.append(skin_name)
                        
                        # Track oldest date for actual skins only
                        if purchase_date:
                            if oldest_date is None or purchase_date < oldest_date:
                                oldest_date = purchase_date
                        
                        # Check for rare skins
                        rarity = self._check_rare_skin(skin_name)
                        if rarity == 'high':
                            rare_skins_high.append(skin_name)
                        elif rarity == 'medium':
                            rare_skins_medium.append(skin_name)
            
            result['data']['skins_count'] = len(skins_list)
            result['data']['skins_list'] = skins_list
            result['data']['chromas_count'] = len(chromas_list)
            result['data']['chromas_list'] = chromas_list
            result['data']['rare_skins_high'] = rare_skins_high
            result['data']['rare_skins_medium'] = rare_skins_medium
            
            # Account age estimation
            if oldest_date:
                result['data']['account_created_est'] = oldest_date.strftime("%B %Y")
                result['data']['oldest_skin_date'] = oldest_date.strftime("%d/%m/%Y")
            else:
                result['data']['account_created_est'] = "Unknown"
                result['data']['oldest_skin_date'] = "Unknown"
            
            # =====================
            # 7. ICONS
            # =====================
            if progress_callback:
                progress_callback("Getting icons...")
            
            icons_inventory = self._request('GET', '/lol-inventory/v2/inventory/SUMMONER_ICON')
            self._save_debug(debug_folder, "07_icons_inventory.json", icons_inventory)
            
            icon_names = []
            if icons_inventory:
                for icon in icons_inventory:
                    icon_id = icon.get('itemId', 0)
                    name = self._get_icon_name(icon_id)
                    icon_names.append(name)
            
            result['data']['icons_count'] = len(icon_names)
            result['data']['icons_list'] = icon_names
            
            # =====================
            # 8. WARD SKINS - Find priority wards
            # =====================
            if progress_callback:
                progress_callback("Getting ward skins...")
            
            wards_inventory = self._request('GET', '/lol-inventory/v2/inventory/WARD_SKIN')
            self._save_debug(debug_folder, "08_wards_inventory.json", wards_inventory)
            
            ward_names = []
            priority_wards = []
            if wards_inventory:
                for ward in wards_inventory:
                    ward_id = ward.get('itemId', 0)
                    name = self._get_ward_name(ward_id)
                    ward_names.append(name)
                    
                    # Check for priority wards
                    if self._check_priority_ward(name):
                        priority_wards.append(name)
            
            result['data']['wards_count'] = len(ward_names)
            result['data']['wards_list'] = ward_names
            result['data']['priority_wards'] = priority_wards
            
            # =====================
            # GENERATE TITLE AND DESCRIPTION
            # =====================
            result['data']['generated_title'] = self._generate_title(result['data'])
            result['data']['generated_description'] = self._generate_description(result['data'])
            
            # =====================
            # SAVE SUMMARY
            # =====================
            summary = f"""
=== EXTRACTION SUMMARY ===
Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

ACCOUNT INFO:
- Summoner: {result['data'].get('username')}
- Riot ID: {result['data'].get('riot_id')}
- Level: {result['data'].get('level')}
- Region: {result['data'].get('region')} ({self._format_region(result['data'].get('region'))})
- Rank: {result['data'].get('rank')}
- Account Created (Est.): {result['data'].get('account_created_est')}

CURRENCY:
- Blue Essence: {result['data'].get('blue_essence'):,}
- RP: {result['data'].get('rp'):,}

COLLECTION:
- Champions: {result['data'].get('champions_count')}
- Skins: {result['data'].get('skins_count')}
- Chromas: {result['data'].get('chromas_count')}
- Icons: {result['data'].get('icons_count')}
- Wards: {result['data'].get('wards_count')}

RARE ITEMS:
- High Priority Skins: {', '.join(rare_skins_high) if rare_skins_high else 'None'}
- Medium Priority Skins: {', '.join(rare_skins_medium) if rare_skins_medium else 'None'}
- Priority Wards: {', '.join(priority_wards) if priority_wards else 'None'}

GENERATED TITLE:
{result['data'].get('generated_title')}

GENERATED DESCRIPTION:
{result['data'].get('generated_description')}

Debug folder: {debug_folder}
"""
            self._save_debug(debug_folder, "00_SUMMARY.txt", summary)
            
            # Save lists
            self._save_debug(debug_folder, "SKINS_LIST.txt", f"Total Skins: {len(skins_list)}\n{'='*50}\n" + "\n".join(sorted(skins_list)))
            self._save_debug(debug_folder, "ICONS_LIST.txt", f"Total Icons: {len(icon_names)}\n{'='*50}\n" + "\n".join(sorted(icon_names)))
            self._save_debug(debug_folder, "WARDS_LIST.txt", f"Total Wards: {len(ward_names)}\n{'='*50}\n" + "\n".join(sorted(ward_names)))
            
            # Save rare skins separately
            all_rare = rare_skins_high + rare_skins_medium
            self._save_debug(debug_folder, "RARE_SKINS.txt", f"Total Rare Skins: {len(all_rare)}\n{'='*50}\nHigh Priority:\n" + "\n".join(rare_skins_high) + "\n\nMedium Priority:\n" + "\n".join(rare_skins_medium))
            
            result['success'] = True
            result['debug_folder'] = debug_folder
            
            if progress_callback:
                progress_callback(f"Done! Check: {debug_folder}")
            
            # Open debug folder automatically
            try:
                import platform
                if platform.system() == 'Windows':
                    os.startfile(debug_folder)
            except:
                pass
            
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
            import traceback
            self._save_debug(debug_folder, "ERROR.txt", traceback.format_exc())
        
        return result


def test_extractor():
    """Test the extractor"""
    extractor = LoLExtractor()
    
    print("Checking if League Client is running...")
    if not extractor.is_client_running():
        print("❌ League Client is not running!")
        print("Please open League of Legends and login first.")
        return
    
    print("✓ League Client detected!")
    print("Extracting account data...\n")
    
    def progress(msg):
        print(f"  {msg}")
    
    result = extractor.extract_all(progress_callback=progress)
    
    if result['success']:
        print("\n" + "=" * 50)
        print("✓ EXTRACTION SUCCESSFUL!")
        print("=" * 50)
        data = result['data']
        print(f"\nGenerated Title:")
        print(data.get('generated_title'))
        print(f"\nGenerated Description:")
        print(data.get('generated_description'))
        print(f"\nDebug files: {result.get('debug_folder')}")
    else:
        print(f"\n❌ Extraction failed: {result['error']}")


if __name__ == "__main__":
    test_extractor()
