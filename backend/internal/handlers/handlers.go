package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/ravan-ai/agni-keymon/internal/auth"
	"github.com/ravan-ai/agni-keymon/internal/config"
	"github.com/ravan-ai/agni-keymon/internal/crypto"
	"github.com/ravan-ai/agni-keymon/internal/db"
	"github.com/ravan-ai/agni-keymon/internal/models"
	"github.com/ravan-ai/agni-keymon/internal/service"
)

type API struct {
	cfg     config.Config
	store   *db.Store
	auth    *auth.Service
	box     *crypto.Box
	checker *service.Checker
}

func New(cfg config.Config, store *db.Store, authSvc *auth.Service, box *crypto.Box, checker *service.Checker) *API {
	return &API{cfg: cfg, store: store, auth: authSvc, box: box, checker: checker}
}

func (a *API) Health(c *gin.Context) {
	if err := a.store.Ping(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (a *API) Login(c *gin.Context) {
	var req loginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	u, err := a.store.GetUserByEmail(c.Request.Context(), strings.TrimSpace(strings.ToLower(req.Email)))
	if err != nil || !a.auth.CheckPassword(u.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}
	tok, err := a.auth.IssueToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token issue failed"})
		return
	}
	a.auth.SetCookie(c, tok)
	c.JSON(http.StatusOK, gin.H{
		"user":  gin.H{"id": u.ID, "email": u.Email, "role": u.Role},
		"token": tok,
	})
}

func (a *API) Logout(c *gin.Context) {
	a.auth.ClearCookie(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *API) Me(c *gin.Context) {
	uid, ok := auth.UserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	u, err := a.store.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": u.ID, "email": u.Email, "role": u.Role})
}

func (a *API) Dashboard(c *gin.Context) {
	var filter *uuid.UUID
	if q := c.Query("project_id"); q != "" {
		id, err := uuid.Parse(q)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad project_id"})
			return
		}
		filter = &id
	}
	rows, err := a.store.Dashboard(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"projects": rows})
}

func (a *API) ListProjects(c *gin.Context) {
	projects, err := a.store.ListProjects(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	type item struct {
		models.Project
		Members []models.ProjectMember `json:"members"`
	}
	out := make([]item, 0, len(projects))
	for _, p := range projects {
		members, err := a.store.ListMembers(c.Request.Context(), p.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		out = append(out, item{Project: p, Members: members})
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

func (a *API) GetProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	p, err := a.store.GetProject(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	members, err := a.store.ListMembers(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"project": p, "members": members})
}

type projectReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (a *API) CreateProject(c *gin.Context) {
	var req projectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	p := &models.Project{Name: req.Name, Description: req.Description}
	if err := a.store.CreateProject(c.Request.Context(), p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

func (a *API) UpdateProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	existing, err := a.store.GetProject(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req projectReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if name := strings.TrimSpace(req.Name); name != "" {
		existing.Name = name
	}
	existing.Description = req.Description
	if err := a.store.UpdateProject(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, existing)
}

func (a *API) DeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	if err := a.store.DeleteProject(c.Request.Context(), id); err != nil {
		if db.ErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type memberReq struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	RoleLabel string `json:"role_label"`
}

func (a *API) AddMember(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	if _, err := a.store.GetProject(c.Request.Context(), pid); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	var req memberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	m := &models.ProjectMember{
		ProjectID: pid,
		Name:      req.Name,
		Email:     strings.TrimSpace(req.Email),
		Phone:     strings.TrimSpace(req.Phone),
		RoleLabel: strings.TrimSpace(req.RoleLabel),
	}
	if err := a.store.AddMember(c.Request.Context(), m); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, m)
}

func (a *API) UpdateMember(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	mid, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad member id"})
		return
	}
	var req memberReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	m := &models.ProjectMember{
		ID:        mid,
		ProjectID: pid,
		Name:      strings.TrimSpace(req.Name),
		Email:     strings.TrimSpace(req.Email),
		Phone:     strings.TrimSpace(req.Phone),
		RoleLabel: strings.TrimSpace(req.RoleLabel),
	}
	if m.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	if err := a.store.UpdateMember(c.Request.Context(), m); err != nil {
		if db.ErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, m)
}

func (a *API) DeleteMember(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	mid, err := uuid.Parse(c.Param("memberId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad member id"})
		return
	}
	if err := a.store.DeleteMember(c.Request.Context(), pid, mid); err != nil {
		if db.ErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *API) CheckProject(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	go a.checker.CheckProject(context.Background(), pid)
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "message": "project check started"})
}

func (a *API) ListKeys(c *gin.Context) {
	var (
		keys []models.APIKey
		err  error
	)
	if q := c.Query("project_id"); q != "" {
		pid, perr := uuid.Parse(q)
		if perr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad project_id"})
			return
		}
		keys, err = a.store.ListKeysByProject(c.Request.Context(), pid)
	} else {
		keys, err = a.store.ListKeys(c.Request.Context())
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	out := make([]models.APIKey, 0, len(keys))
	for _, k := range keys {
		k.EncryptedKey = ""
		out = append(out, k)
	}
	c.JSON(http.StatusOK, gin.H{"items": out})
}

type keyReq struct {
	Provider    string          `json:"provider"`
	Label       string          `json:"label"`
	ProjectID   string          `json:"project_id"`
	ProjectName string          `json:"project_name"` // legacy ignored if project_id set
	ProjectEnv  string          `json:"project_env"`
	Secret      string          `json:"secret"`
	Meta        json.RawMessage `json:"meta"`
	Notes       string          `json:"notes"`
}

func validEnv(e string) bool {
	switch models.ProjectEnv(e) {
	case models.EnvProd, models.EnvStaging, models.EnvTesting, models.EnvOther:
		return true
	}
	return false
}

func (a *API) CreateKey(c *gin.Context) {
	var req keyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	req.Provider = strings.TrimSpace(req.Provider)
	pid, err := uuid.Parse(strings.TrimSpace(req.ProjectID))
	if err != nil || req.Provider == "" || req.Secret == "" || !validEnv(req.ProjectEnv) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "provider, project_id, secret, project_env required"})
		return
	}
	enc, err := a.box.Seal(req.Secret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "encrypt failed"})
		return
	}
	k := &models.APIKey{
		Provider:     req.Provider,
		Label:        req.Label,
		ProjectID:    pid,
		ProjectEnv:   models.ProjectEnv(req.ProjectEnv),
		EncryptedKey: enc,
		KeyHint:      crypto.Hint(req.Secret),
		Meta:         req.Meta,
		Notes:        req.Notes,
	}
	if err := a.store.CreateKey(c.Request.Context(), k); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	k.EncryptedKey = ""
	go func(id uuid.UUID) {
		_, _ = a.checker.CheckKey(context.Background(), id)
	}(k.ID)
	c.JSON(http.StatusCreated, k)
}

func (a *API) UpdateKey(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	existing, err := a.store.GetKey(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	var req keyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if req.Provider != "" {
		existing.Provider = strings.TrimSpace(req.Provider)
	}
	existing.Label = req.Label
	if req.ProjectID != "" {
		pid, err := uuid.Parse(req.ProjectID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "bad project_id"})
			return
		}
		existing.ProjectID = pid
	}
	if req.ProjectEnv != "" {
		if !validEnv(req.ProjectEnv) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_env"})
			return
		}
		existing.ProjectEnv = models.ProjectEnv(req.ProjectEnv)
	}
	if req.Secret != "" {
		enc, err := a.box.Seal(req.Secret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encrypt failed"})
			return
		}
		existing.EncryptedKey = enc
		existing.KeyHint = crypto.Hint(req.Secret)
	}
	if req.Meta != nil {
		existing.Meta = req.Meta
	}
	existing.Notes = req.Notes
	if err := a.store.UpdateKey(c.Request.Context(), existing); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	existing.EncryptedKey = ""
	c.JSON(http.StatusOK, existing)
}

func (a *API) DeleteKey(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	if err := a.store.DeleteKey(c.Request.Context(), id); err != nil {
		if db.ErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *API) CheckKey(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad id"})
		return
	}
	snap, err := a.checker.CheckKey(c.Request.Context(), id)
	if err != nil {
		if db.ErrNoRows(err) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, snap)
}

func (a *API) CheckAll(c *gin.Context) {
	go a.checker.CheckAll(context.Background())
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "message": "check started"})
}
