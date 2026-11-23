package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/ravan-ai/agni-keymon/internal/config"
	"github.com/ravan-ai/agni-keymon/internal/models"
	"golang.org/x/crypto/bcrypt"
)

const cookieName = "keymon_session"

type Claims struct {
	UserID string      `json:"uid"`
	Email  string      `json:"email"`
	Role   models.Role `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	cfg config.Config
}

func New(cfg config.Config) *Service {
	return &Service{cfg: cfg}
}

func (s *Service) CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func (s *Service) IssueToken(u *models.User) (string, error) {
	claims := Claims{
		UserID: u.ID.String(),
		Email:  u.Email,
		Role:   u.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "agni-keymon",
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.cfg.JWTSecret))
}

func (s *Service) ParseToken(tokenStr string) (*Claims, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

func (s *Service) SetCookie(c *gin.Context, token string) {
	sameSite := http.SameSiteLaxMode
	switch s.cfg.CookieSameSite {
	case "strict":
		sameSite = http.SameSiteStrictMode
	case "none":
		sameSite = http.SameSiteNoneMode
	}
	c.SetSameSite(sameSite)
	c.SetCookie(cookieName, token, int((12 * time.Hour).Seconds()), "/", "", s.cfg.CookieSecure, true)
}

func (s *Service) ClearCookie(c *gin.Context) {
	c.SetCookie(cookieName, "", -1, "/", "", s.cfg.CookieSecure, true)
}

func (s *Service) TokenFromRequest(c *gin.Context) string {
	if tok, err := c.Cookie(cookieName); err == nil && tok != "" {
		return tok
	}
	h := c.GetHeader("Authorization")
	if len(h) > 7 && (h[:7] == "Bearer " || h[:7] == "bearer ") {
		return h[7:]
	}
	return ""
}

func UserID(c *gin.Context) (uuid.UUID, bool) {
	v, ok := c.Get("user_id")
	if !ok {
		return uuid.Nil, false
	}
	id, ok := v.(uuid.UUID)
	return id, ok
}

func Role(c *gin.Context) models.Role {
	v, _ := c.Get("role")
	r, _ := v.(models.Role)
	return r
}

func (s *Service) Middleware(required ...models.Role) gin.HandlerFunc {
	need := map[models.Role]bool{}
	for _, r := range required {
		need[r] = true
	}
	return func(c *gin.Context) {
		tok := s.TokenFromRequest(c)
		if tok == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		claims, err := s.ParseToken(tok)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		uid, err := uuid.Parse(claims.UserID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		if len(need) > 0 && !need[claims.Role] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Set("user_id", uid)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Next()
	}
}
