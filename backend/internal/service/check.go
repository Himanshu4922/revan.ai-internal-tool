package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/ravan-ai/agni-keymon/internal/alerts"
	"github.com/ravan-ai/agni-keymon/internal/checkers"
	"github.com/ravan-ai/agni-keymon/internal/config"
	"github.com/ravan-ai/agni-keymon/internal/crypto"
	"github.com/ravan-ai/agni-keymon/internal/db"
	"github.com/ravan-ai/agni-keymon/internal/models"
)

type Checker struct {
	cfg    config.Config
	store  *db.Store
	box    *crypto.Box
	alerts *alerts.Service
}

func NewChecker(cfg config.Config, store *db.Store, box *crypto.Box, al *alerts.Service) *Checker {
	return &Checker{cfg: cfg, store: store, box: box, alerts: al}
}

func (c *Checker) CheckKey(ctx context.Context, id uuid.UUID) (*models.CreditSnapshot, error) {
	key, err := c.store.GetKey(ctx, id)
	if err != nil {
		return nil, err
	}
	secret, err := c.box.Open(key.EncryptedKey)
	if err != nil {
		snap := &models.CreditSnapshot{
			APIKeyID:  key.ID,
			Status:    models.StatusError,
			Error:     "decrypt failed: " + err.Error(),
			CheckedAt: time.Now().UTC(),
		}
		_ = c.store.InsertSnapshot(ctx, snap)
		return snap, nil
	}
	res := checkers.ForProvider(key.Provider).Check(ctx, secret, key.Meta)
	res = checkers.ApplyThreshold(res, c.cfg.AlertLowThreshold)
	snap := &models.CreditSnapshot{
		APIKeyID:    key.ID,
		Status:      res.Status,
		Balance:     res.Balance,
		Currency:    res.Currency,
		SpendPeriod: res.SpendPeriod,
		SpendAmount: res.SpendAmount,
		RawSummary:  res.Summary,
		Error:       res.Error,
		CheckedAt:   time.Now().UTC(),
	}
	if err := c.store.InsertSnapshot(ctx, snap); err != nil {
		return nil, err
	}
	c.alerts.MaybeAlert(ctx, *key, *snap)
	return snap, nil
}

func (c *Checker) CheckAll(ctx context.Context) {
	keys, err := c.store.ListKeys(ctx)
	if err != nil {
		return
	}
	for _, k := range keys {
		_, _ = c.CheckKey(ctx, k.ID)
	}
}

func (c *Checker) CheckProject(ctx context.Context, projectID uuid.UUID) {
	keys, err := c.store.ListKeysByProject(ctx, projectID)
	if err != nil {
		return
	}
	for _, k := range keys {
		_, _ = c.CheckKey(ctx, k.ID)
	}
}
