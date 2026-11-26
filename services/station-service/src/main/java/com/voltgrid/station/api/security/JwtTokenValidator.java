package com.voltgrid.station.api.security;

import com.voltgrid.station.domain.security.AuthenticatedUser;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.*;

@Component
public class JwtTokenValidator {

    private final JwtDecoder jwtDecoder;

    @Autowired
    public JwtTokenValidator(
            @Value("${voltgrid.security.jwt.issuer:}") String issuer,
            @Value("${voltgrid.security.jwt.audience:voltgrid-api}") String audience,
            @Value("${voltgrid.security.jwt.jwk-set-uri:}") String jwksUri,
            @Value("${voltgrid.security.require-auth:true}") boolean requireAuth
    ) {
        if (issuer.isBlank() || jwksUri.isBlank() || audience.isBlank()) {
            if (requireAuth) {
                throw new IllegalStateException("An OIDC issuer, JWKS URI and API audience are required");
            }
            this.jwtDecoder = null;
            return;
        }
        this.jwtDecoder = configure(NimbusJwtDecoder.withJwkSetUri(jwksUri)
                .jwsAlgorithm(SignatureAlgorithm.RS256).build(), issuer, audience);
    }

    JwtTokenValidator(String issuer, String audience, NimbusJwtDecoder decoder) {
        this.jwtDecoder = configure(decoder, issuer, audience);
    }

    private static JwtDecoder configure(NimbusJwtDecoder decoder, String issuer, String audience) {
        List<OAuth2TokenValidator<Jwt>> validators = List.of(
                new JwtTimestampValidator(Duration.ofSeconds(30)),
                new JwtIssuerValidator(issuer),
                new JwtClaimValidator<List<String>>(JwtClaimNames.AUD,
                        values -> values != null && values.contains(audience)),
                new JwtClaimValidator<String>(JwtClaimNames.SUB,
                        subject -> subject != null && !subject.isBlank()),
                new JwtClaimValidator<Object>(JwtClaimNames.EXP, Objects::nonNull),
                new JwtClaimValidator<Object>("typ", "Bearer"::equals)
        );
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return decoder;
    }

    public Optional<AuthenticatedUser> validateAndExtract(String token, String requestedOrganizationId) {
        if (jwtDecoder == null || token == null || token.isBlank()) {
            return Optional.empty();
        }

        token = token.trim();

        try {
            Jwt jwt = this.jwtDecoder.decode(token);

            String sub = jwt.getSubject();
            if (sub == null || sub.isBlank()) {
                return Optional.empty();
            }

            String email = jwt.getClaimAsString("email");
            if (email == null || email.isBlank()) {
                email = "";
            }

            Set<String> roles = extractRoles(jwt);

            String tokenOrg = jwt.getClaimAsString("org_id");
            if (tokenOrg == null || tokenOrg.isBlank()) {
                tokenOrg = jwt.getClaimAsString("tenant_id");
            }

            String activeOrg = requestedOrganizationId != null && !requestedOrganizationId.isBlank()
                    ? requestedOrganizationId : tokenOrg;

            if (activeOrg == null || activeOrg.isBlank()) {
                return Optional.empty();
            }

            return Optional.of(new AuthenticatedUser(sub, email, roles, activeOrg));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    private Set<String> extractRoles(Jwt jwt) {
        Set<String> roles = new HashSet<>();
        List<String> rolesClaim = jwt.getClaimAsStringList("roles");
        if (rolesClaim != null) {
            roles.addAll(rolesClaim);
        }

        return roles;
    }
}
