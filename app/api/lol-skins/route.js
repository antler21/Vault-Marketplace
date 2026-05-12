import { supabase } from '../../lib/supabase'

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      summonerName, tagLine, summonerLevel, profileIconId, puuid,
      region,
      rp, be,
      soloRank, flexRank, tftRank,
      ownedSkinIds, ownedChromaIds,
      ownedEmoteIds, ownedIconIds, ownedWardIds, ownedFinisherIds,
      tftCompanionIds, tftMapSkinIds, tftDamageSkinIds,
      lootSummary, championMastery,
      vintageSkinIds, accountCreatedEstimate, firstRpPurchaseDate, firstRpPurchaseItemId, firstRpPurchaseItemType,
      // link-generation settings (set when user clicks Generate Link)
      hideName, expiresAt,
      oge, ogi, ogiPartial, ogiVerified,
      priceAmount, priceCurrency,
    } = body

    if (!ownedSkinIds?.length) return Response.json({ error: 'No skin data received' }, { status: 400 })

    const { data, error } = await supabase
      .from('lol_skin_scans')
      .insert([{
        summoner_name:       summonerName || '',
        tag_line:            tagLine || '',
        summoner_level:      summonerLevel || null,
        profile_icon_id:     profileIconId || null,
        puuid:               puuid || null,
        region:              region || null,
        rp:                  rp ?? null,
        be:                  be ?? null,
        solo_rank:           soloRank || null,
        flex_rank:           flexRank || null,
        tft_rank:            tftRank || null,
        owned_skin_ids:      ownedSkinIds,
        owned_chroma_ids:    ownedChromaIds || [],
        owned_emote_ids:     ownedEmoteIds || [],
        owned_icon_ids:      ownedIconIds || [],
        owned_ward_ids:      ownedWardIds || [],
        owned_finisher_ids:  ownedFinisherIds || [],
        tft_companion_ids:   tftCompanionIds || [],
        tft_map_skin_ids:    tftMapSkinIds || [],
        tft_damage_skin_ids: tftDamageSkinIds || [],
        loot_summary:        lootSummary || {},
        champion_mastery:         Array.isArray(championMastery) ? championMastery : [],
        vintage_skin_ids:         vintageSkinIds || [],
        account_created_estimate: accountCreatedEstimate || null,
        first_rp_purchase_date:      firstRpPurchaseDate || null,
        first_rp_purchase_item_id:   firstRpPurchaseItemId ?? null,
        first_rp_purchase_item_type: firstRpPurchaseItemType || null,
        hide_name:                hideName ?? false,
        expires_at:          expiresAt || null,
        oge:                 oge ?? false,
        ogi:                 ogi ?? false,
        ogi_partial:         ogiPartial ?? false,
        ogi_verified:        ogiVerified ?? false,
        price_amount:        priceAmount ?? null,
        price_currency:      priceCurrency || null,
      }])
      .select('id, owner_token')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ id: data.id, owner_token: data.owner_token })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
